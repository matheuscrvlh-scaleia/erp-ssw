/**
 * Parâmetros da URL de `/performance/lista` (os mesmos de hoje, para links e favoritos seguirem
 * valendo), o período da tela, a entrada da API e o título.
 * origem: performance.lista.tsx (sistema atual)
 */
import { recorteSemPeriodo } from "@erp/dominio/listagem/faixas";
import {
  type BaseData,
  BASES_DATA,
  type FaixaPrevisto,
  FAIXAS_PREVISTO,
  type FiltroListaEntrada,
  type OrdemLista,
  ORDENS_LISTA,
  recortesSelecionados,
  STATUS_PREVISTO,
  type StatusPrevisto,
  type TipoRecorte,
  TIPOS_RECORTE,
} from "@erp/shared/contratos/listagem";
import { defaultStringifySearch } from "@tanstack/react-router";

import {
  type AtalhoPeriodo,
  ATALHOS_PERIODO,
  type Periodo,
  resolverPeriodo,
} from "@/componentes/comum/periodo";

const PERIODOS: readonly Periodo[] = [...ATALHOS_PERIODO, "custom"];

export interface BuscaDaLista {
  tipo: TipoRecorte;
  /** Recortes marcados além de `tipo`. */
  recortes?: TipoRecorte[] | undefined;
  codigo: number | null;
  faixa_min: number | null;
  faixa_max: number | null;
  status_previsto: StatusPrevisto | null;
  faixa_prev: FaixaPrevisto | null;
  ignorar_periodo: boolean;
  periodo: Periodo;
  de: string;
  ate: string;
  unidades: string[];
  filiais: string[];
  parceiros: string[];
  remetente: string;
  destino: string;
  busca: string;
  ctrc: string;
  nf: string;
  codigos: number[];
  tipos: string[];
  cidade: string;
  peso_min: number | null;
  peso_max: number | null;
  atraso_min: number | null;
  atraso_max: number | null;
  sort: OrdemLista;
  dir: "asc" | "desc";
  page: number;
  base: BaseData;
  /** Marca no seletor Ocorrência só os códigos em aberto do recorte (alertas). */
  abertos?: boolean | undefined;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

function textos(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return typeof v === "string" && v.length > 0 ? [v] : [];
}

function inteiros(v: unknown): number[] {
  const lista: unknown[] = Array.isArray(v) ? v : v === undefined || v === "" ? [] : [v];
  return lista.map(Number).filter((n) => Number.isInteger(n));
}

function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function inteiro(v: unknown): number | null {
  const n = numero(v);
  return n === null ? null : Math.trunc(n);
}

function texto(v: unknown): string {
  if (typeof v === "string") return v;
  return typeof v === "number" ? String(v) : "";
}

const sim = (v: unknown) => v === "1" || v === true || v === "true";

function umDe<T extends string>(lista: readonly T[], v: unknown, padrao: T): T;
function umDe<T extends string>(lista: readonly T[], v: unknown, padrao: null): T | null;
function umDe<T extends string>(lista: readonly T[], v: unknown, padrao: T | null): T | null {
  return lista.find((x) => x === v) ?? padrao;
}

/** Lê a URL tolerando links antigos (valor solto onde hoje vai lista, números como texto). */
export function lerBuscaDaLista(bruto: Record<string, unknown>): BuscaDaLista {
  const recortes = textos(bruto["recortes"]).flatMap((t) => {
    const r = umDe(TIPOS_RECORTE, t, null);
    return r ? [r] : [];
  });
  const de = texto(bruto["de"]);
  const ate = texto(bruto["ate"]);
  return {
    tipo: umDe(TIPOS_RECORTE, bruto["tipo"], "emitidos"),
    recortes: recortes.length > 0 ? recortes : undefined,
    codigo: inteiro(bruto["codigo"]),
    faixa_min: inteiro(bruto["faixa_min"]),
    faixa_max: inteiro(bruto["faixa_max"]),
    status_previsto: umDe(STATUS_PREVISTO, bruto["status_previsto"], null),
    faixa_prev: umDe(FAIXAS_PREVISTO, bruto["faixa_prev"], null),
    ignorar_periodo: sim(bruto["ignorar_periodo"]),
    periodo: umDe(PERIODOS, bruto["periodo"], "mes"),
    de: DATA.test(de) ? de : "",
    ate: DATA.test(ate) ? ate : "",
    unidades: textos(bruto["unidades"]),
    filiais: textos(bruto["filiais"]),
    parceiros: textos(bruto["parceiros"]),
    remetente: texto(bruto["remetente"]),
    destino: texto(bruto["destino"]),
    busca: texto(bruto["busca"]),
    ctrc: texto(bruto["ctrc"]),
    nf: texto(bruto["nf"]),
    codigos: inteiros(bruto["codigos"]),
    tipos: textos(bruto["tipos"]),
    cidade: texto(bruto["cidade"]),
    peso_min: numero(bruto["peso_min"]),
    peso_max: numero(bruto["peso_max"]),
    atraso_min: inteiro(bruto["atraso_min"]),
    atraso_max: inteiro(bruto["atraso_max"]),
    sort: umDe(ORDENS_LISTA, bruto["sort"], "emissao"),
    dir: bruto["dir"] === "asc" ? "asc" : "desc",
    page: Math.max(1, inteiro(bruto["page"]) ?? 1),
    base: umDe(BASES_DATA, bruto["base"], "emissao"),
    abertos: sim(bruto["abertos"]) || undefined,
  };
}

const ROTULO_DO_PERIODO: Record<AtalhoPeriodo, string> = {
  hoje: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  mes: "Este mês",
  mes_anterior: "Mês anterior",
};

/**
 * Período da tela e o rótulo do título. `hoje` é o dia de Brasília (Q11), vindo de fora.
 * origem: resolvePeriodo (performance.lista.tsx, sistema atual)
 */
export function periodoDaLista(
  busca: Pick<BuscaDaLista, "periodo" | "de" | "ate">,
  hoje: string,
): { inicio: string; fim: string; rotulo: string } {
  const { inicio, fim } = resolverPeriodo(busca.periodo, busca.de, busca.ate, hoje);
  if (busca.periodo === "custom") {
    return { inicio, fim, rotulo: busca.de && busca.ate ? `${inicio} → ${fim}` : "Este mês" };
  }
  return { inicio, fim, rotulo: ROTULO_DO_PERIODO[busca.periodo] };
}

/** Só o que tem valor vai para a API (query string curta). */
function seTiver<T>(lista: readonly T[]): T[] | undefined {
  return lista.length > 0 ? [...lista] : undefined;
}
const seTexto = (v: string) => (v.trim() ? v : undefined);
const seNumero = (v: number | null) => v ?? undefined;

/** O filtro único da lista na forma da API (lista, gráficos, códigos e exportação). */
export function filtroDaBusca(
  busca: BuscaDaLista,
  periodo: { inicio: string; fim: string },
): FiltroListaEntrada {
  const recortes = recortesSelecionados(busca.tipo, busca.recortes);
  const tem = (r: TipoRecorte) => recortes.includes(r);
  return {
    tipo: busca.tipo,
    recortes: seTiver(busca.recortes ?? []),
    inicio: periodo.inicio,
    fim: periodo.fim,
    base: busca.base,
    ignorarPeriodo: busca.ignorar_periodo || undefined,
    unidades: seTiver(busca.unidades),
    filiais: seTiver(busca.filiais),
    parceiros: seTiver(busca.parceiros),
    remetente: seTexto(busca.remetente),
    destino: seTexto(busca.destino),
    cidade: seTexto(busca.cidade),
    codigos: seTiver(busca.codigos),
    tipos: seTiver(busca.tipos),
    codigoRecorte: tem("por_codigo") ? seNumero(busca.codigo) : undefined,
    faixaMin: tem("por_faixa_atraso") ? seNumero(busca.faixa_min) : undefined,
    faixaMax: tem("por_faixa_atraso") ? seNumero(busca.faixa_max) : undefined,
    pesoMin: seNumero(busca.peso_min),
    pesoMax: seNumero(busca.peso_max),
    atrasoMin: seNumero(busca.atraso_min),
    atrasoMax: seNumero(busca.atraso_max),
    statusPrevisto: tem("previstos_por_status") ? (busca.status_previsto ?? undefined) : undefined,
    faixaPrev: tem("previstos_por_faixa") ? (busca.faixa_prev ?? undefined) : undefined,
    busca: seTexto(busca.busca),
    ctrc: seTexto(busca.ctrc),
    nf: seTexto(busca.nf),
  };
}

/** origem: TIPO_LABEL (performance.lista.tsx, sistema atual) */
export const ROTULO_DO_RECORTE: Record<TipoRecorte, string> = {
  emitidos: "CT-e emitidos",
  entregues: "CT-e entregues",
  no_prazo: "CT-e no prazo",
  fora_prazo: "CT-e fora do prazo",
  atrasados: "CT-e atrasados",
  sem_movimento: "CT-e sem movimento (alerta)",
  penalizados: "CT-e penalizados",
  penalizados_abertos: "Penalizados em aberto (sem baixa)",
  em_atraso: "CT-e em atraso (prazo vencido, sem baixa)",
  em_atraso_fr: "Em atraso (FR)",
  em_atraso_cliente: "Em atraso (aguardando cliente/parceiro)",
  por_codigo: "CT-e por código de ocorrência",
  por_faixa_atraso: "CT-e por faixa de atraso",
  finalizado_sistema: "Finalizado em Sistema",
  previstos_por_status: "Previstos — por status",
  previstos_por_faixa: "Previstos — por vencimento",
  sla_fr: "SLA de Pontualidade (FR)",
  sla_cliente: "SLA Cliente (responsabilidade cliente)",
  vencimento_proximo: "Vencendo em 24-48h",
  nascido_atrasado: "Saíram para entrega com prazo vencido",
  nascido_em_atraso: "Nascidos em atraso (emitidos a menos de 48h da previsão)",
  otif: "OTIF — tiveram algum problema no percurso",
  sem_atualizacao: "Sem atualização recente",
  ocorrencia_13: "Entrega prejudicada pelo horário/trânsito (13)",
  ocorrencia_13_multipla: "Entrega prejudicada (13) — 2+ tentativas, sem entrega",
  tde_aguardando: "TDE aguardando programação (sem saída para entrega)",
  ocorr_entregues: "CT-e com ocorrência — entregues",
  ocorr_baixados: "CT-e com ocorrência — baixados sem entrega",
  ocorr_abertos: "CT-e com ocorrência — em aberto",
  ocorr_em_atraso: "CT-e com ocorrência — em aberto e em atraso",
};

const ROTULO_STATUS_PREVISTO: Record<StatusPrevisto, string> = {
  agendamento: "Agendamento",
  programacao: "Programação",
  rota: "Rota",
  pendencia: "Pendência",
  outros: "Outros",
};

const ROTULO_FAIXA_PREVISTO: Record<FaixaPrevisto, string> = {
  vencido: "Vencido",
  hoje: "Vence hoje",
  d1: "D+1",
  d2: "D+2",
  d3_mais: "D+3+",
  sem_prev: "Sem previsão",
};

/** "(FR)" nos rótulos = a transportadora: vira o nome curto da empresa ativa. */
export function rotuloDoRecorte(tipo: TipoRecorte, nomeCurto: string): string {
  return ROTULO_DO_RECORTE[tipo].replace("(FR)", `(${nomeCurto})`);
}

/** Rótulos do seletor Recorte, com o nome curto da empresa no lugar de "(FR)". */
export function rotulosDosRecortes(nomeCurto: string): Record<TipoRecorte, string> {
  const rotulos = { ...ROTULO_DO_RECORTE };
  for (const t of TIPOS_RECORTE) rotulos[t] = rotuloDoRecorte(t, nomeCurto);
  return rotulos;
}

function tituloDoRecorte(tipo: TipoRecorte, busca: BuscaDaLista, nomeCurto: string): string {
  let titulo = rotuloDoRecorte(tipo, nomeCurto);
  if (tipo === "por_codigo" && busca.codigo !== null) titulo += ` #${busca.codigo}`;
  if (tipo === "por_faixa_atraso") {
    const min = busca.faixa_min ?? 0;
    titulo += busca.faixa_max !== null ? ` (${min}–${busca.faixa_max} dias)` : ` (${min}+ dias)`;
  }
  if (tipo === "previstos_por_status" && busca.status_previsto) {
    titulo += ` · ${ROTULO_STATUS_PREVISTO[busca.status_previsto]}`;
  }
  if (tipo === "previstos_por_faixa" && busca.faixa_prev) {
    titulo += ` · ${ROTULO_FAIXA_PREVISTO[busca.faixa_prev]}`;
  }
  if (tipo === "finalizado_sistema" && busca.codigo !== null) titulo += ` · código ${busca.codigo}`;
  if ((tipo === "penalizados" || tipo === "penalizados_abertos") && busca.unidades.length === 1) {
    titulo += ` em ${busca.unidades[0] ?? ""}`;
  }
  return titulo;
}

/**
 * Título: os recortes unidos por " + " e o período (ou "Todos em aberto" nos recortes sem
 * período quando a tela ignora o período).
 * origem: titleFor (performance.lista.tsx, sistema atual)
 */
export function tituloDaLista(busca: BuscaDaLista, rotuloDoPeriodo: string, nomeCurto: string) {
  const recortes = recortesSelecionados(busca.tipo, busca.recortes);
  const titulo = recortes.map((r) => tituloDoRecorte(r, busca, nomeCurto)).join(" + ");
  const sufixo =
    busca.ignorar_periodo && recortes.some(recorteSemPeriodo) ? "Todos em aberto" : rotuloDoPeriodo;
  return `${titulo} — ${sufixo}`;
}

/**
 * Endereço da Listagem para quem abre a lista de outra tela: só os parâmetros preenchidos (listas
 * em JSON, como o roteador lê); o que ficar de fora volta ao padrão da rota.
 */
export function caminhoDaLista(busca: Partial<BuscaDaLista>): string {
  const preenchidos = Object.fromEntries(
    Object.entries(busca).filter(
      ([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0),
    ),
  );
  return `/performance/lista${defaultStringifySearch(preenchidos)}`;
}
