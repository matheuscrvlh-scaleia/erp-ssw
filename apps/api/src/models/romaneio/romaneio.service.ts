/**
 * Casos de uso da tela Romaneio. O repositório traz os CT-e que passam nos filtros (consulta
 * set-based) com as ocorrências que contam; a regra (situação, cards, recortes, viagens) é do
 * `@erp/dominio/romaneio`. Spec: docs/regras/03-romaneio-prazo-parceiro.md.
 *
 * Escopo por unidade/equipe (Q26): desligado até existir a tela que grava a unidade do usuário;
 * todos veem tudo da própria empresa (RLS).
 */
import {
  ehTipoPendencia,
  normCodigoOcorr,
  padroesTextoFiltro,
  unidadeResponsavel,
} from "@erp/dominio/nucleo";
import {
  type CteDoDia,
  ctesDaFaixa,
  type Linha036,
  romaneioDoDia,
  SEM_TIPO,
} from "@erp/dominio/romaneio/hoje";
import {
  type Linha930,
  linhaDoTempo,
  type OcorrenciaGravada,
} from "@erp/dominio/romaneio/linha-do-tempo";
import {
  casaFiltrosDaLista,
  type FatoDaLista,
  type ItemDaLista,
  ordenarLista,
  paginaDaLista,
  resumirLista,
} from "@erp/dominio/romaneio/lista";
import {
  CODIGO_RETORNO,
  CODIGO_SAIDA,
  CODIGOS_ROTA,
  codigosPrejuizo,
  COLLATOR,
  ctrcDigitado,
  nfDigitada,
  normNome,
  normPlaca,
} from "@erp/dominio/romaneio/normalizacao";
import {
  analisarCte,
  type Cadastro,
  type CodigoCadastrado,
  criarCadastro,
  distribuicaoDosNaoFinalizados,
  estaSemMovimento,
  type FatoCte,
  kpisDoRomaneio,
  motivosDeNaoEntrega,
  type Periodo,
  totaisDoTopo,
} from "@erp/dominio/romaneio/situacao";
import {
  type ContextoPorViagem,
  type CteComViagens,
  ctesPorCarro,
  type MotoristaDeEquipe,
  performanceAjudante,
  performanceCarro,
  performanceMotorista,
  porViagem,
  prejuizo,
  type Viagem,
} from "@erp/dominio/romaneio/viagens";
import { type SaidaDe } from "@erp/shared/contrato";
import {
  type CampoData,
  type contratosRomaneio,
  type FiltrosRomaneio,
  LIMITE_EXPORTACAO,
  type LinhaExportada,
  type LinhaLista,
} from "@erp/shared/contratos/romaneio";
import { hojeNoFuso } from "@erp/shared/datas";
import { type z } from "@erp/shared/zod";

import { type Executor } from "../repositorios";

type C = typeof contratosRomaneio;
/** Entrada já validada (com os padrões do contrato aplicados). */
type Entrada<K extends keyof C> = C[K] extends { entrada: infer E extends z.ZodType }
  ? z.output<E>
  : never;
type Saida<K extends keyof C> = SaidaDe<C[K]>;

// ---------------------------------------------------------------------------------------------
// Porta do repositório

/** Filtros já normalizados (siglas recortadas às filiais próprias, padrões de texto prontos). */
export interface FiltrosNormalizados {
  campo: CampoData;
  periodo: Periodo;
  filiaisProprias: readonly string[];
  unidades: readonly string[] | null;
  /** Dígitos do CNPJ do pagador. */
  pagadores: readonly string[] | null;
  /** Unidade responsável (já dentro das filiais próprias). */
  filiais: readonly string[] | null;
  unidadeAtual: readonly string[] | null;
  /** Padrões ILIKE (`texto_casa_filtro`). */
  remetente: readonly string[] | null;
  destino: readonly string[] | null;
  previsao: string | null;
  codigos: readonly number[] | null;
  placas: readonly string[] | null;
  motoristas: readonly string[] | null;
  /** Em maiúsculas; `__SEM_TIPO__` = sem tipo. */
  tipos: readonly string[] | null;
}

export interface ConsultaDeCtes {
  filtros: FiltrosNormalizados;
  ctrc: { sigla: string | null; numero: string } | null;
  nf: number | null;
  /** Busca livre, literal (Q10: `%` e `_` não são curinga). */
  busca: string | null;
  /** Ajudante no último romaneio do CT-e (motivos de não entrega). */
  ajudantes: readonly string[] | null;
  /** Só estes CT-e (exportação "somente as marcadas"). */
  ids: readonly string[] | null;
  /** Ocorrências que a regra precisa; nulo = todas (ex.: "sem movimento"). */
  codigosOcorrencia: readonly number[] | null;
}

export { type FatoDaLista } from "@erp/dominio/romaneio/lista";

/** Colunas só de exibição, lidas para a página (ou a exportação). */
export interface DetalheDaLinha {
  id: string;
  unidadeCidade: string | null;
  unidadeUf: string | null;
  unidadeAtual: string | null;
  placa: string | null;
  motorista: string | null;
  destinatario: string | null;
  bairro: string | null;
  endereco: string | null;
  cep: string | null;
  valorMercadoria: number | null;
  ocorrEfetivaDescricao: string | null;
  ocorrEfetivaData: Date | null;
  ocorrEfetivaFonte: string | null;
  atrasoDias: number | null;
  performanceDias: number | null;
  responsabilidadeCliente: boolean | null;
  placaColeta: string | null;
  placaEntrega: string | null;
}

export interface RecorteDeViagens {
  /** Só viagens com saída no período (base de data "saída"). */
  saidaEntre: Periodo | null;
  placas: readonly string[] | null;
  motoristas: readonly string[] | null;
}

/** CT-e casado com o 036 do dia, com as siglas de unidade para a unidade responsável. */
export type CteDoDiaGravado = Omit<CteDoDia, "unidadeResponsavel"> & {
  unidadeDestino: string | null;
  unidadeAtual: string | null;
  filial: string | null;
};

export interface RepositorioRomaneio {
  filiaisProprias(): Promise<{ sigla: string; nome: string }[]>;
  codigos(): Promise<CodigoCadastrado[]>;
  /** Valor por chave: o da empresa, senão o da plataforma. */
  configuracoes(chaves: readonly string[]): Promise<Map<string, string>>;
  ctes(consulta: ConsultaDeCtes): Promise<FatoDaLista[]>;
  detalhes(ids: readonly string[]): Promise<DetalheDaLinha[]>;
  viagens(ids: readonly string[], recorte: RecorteDeViagens): Promise<Map<string, Viagem[]>>;
  motoristasDeEquipe(): Promise<MotoristaDeEquipe[]>;
  /** Placas e motoristas com saída no período (sempre pela data de saída). */
  opcoesPlacaMotorista(
    periodo: Periodo,
    placas: readonly string[] | null,
    motoristas: readonly string[] | null,
  ): Promise<{ placas: string[]; motoristas: string[] }>;
  /** Pagadores e tipos de documento do período, na mesma base de data da tela. */
  pagadoresETipos(
    campo: CampoData,
    periodo: Periodo,
    filiaisProprias: readonly string[],
  ): Promise<{ pagadores: { cnpj: string; nome: string }[]; tipos: string[] }>;
  /** Linhas do 036 emitidas no dia, sem lotes ainda em importação. */
  linhas036DoDia(dia: string): Promise<Linha036[]>;
  /** CT-e com esses números (qualquer sigla) e as ocorrências dos códigos dados. */
  ctesDoDia(
    numeros: readonly string[],
    codigosOcorrencia: readonly number[],
  ): Promise<CteDoDiaGravado[]>;
  linhaDoTempo(
    sigla: string,
    numero: string,
  ): Promise<{ ocorrencias: OcorrenciaGravada[]; linhas930: Linha930[] }>;
}

/** Empresa e permissões de quem pede, já validadas pela rota. */
export interface ContextoRomaneio {
  fuso: string;
  /** Permissão `romaneio_placa` (placas em Performance Motorista/Ajudante). */
  verPlaca: boolean;
}

type Db = Executor<"romaneio">;

// ---------------------------------------------------------------------------------------------
// Regras comuns

/** Configurações da empresa (Q48: o que era fixo da FR) e o padrão de cada uma. */
const CONFIG = {
  diasSemMovimento: { chave: "alerta_dias_sem_movimento", padrao: 3 },
  pesoCritico: { chave: "romaneio_peso_critico_kg", padrao: 100 },
  volumeCritico: { chave: "romaneio_volume_critico", padrao: 10 },
} as const;

/** Opções do filtro "Local. atual" (Q48). Sem configuração: as siglas da FR de hoje. */
const LOCAIS_ATUAIS = {
  chave: "romaneio_opcoes_local_atual",
  padrao: ["MTZ", "CAP", "RIO", "ARA", "SIN", "SIA", "GDR", "VRD", "NOF", "TRS", "RRT", "COU"],
} as const;

function numeroDaConfiguracao(valores: Map<string, string>, c: { chave: string; padrao: number }) {
  const valor = valores.get(c.chave);
  const n = Number(valor);
  return valor !== undefined && valor.trim() !== "" && Number.isFinite(n) ? n : c.padrao;
}

interface Regras {
  filiaisProprias: string[];
  cadastro: Cadastro;
  codigos: CodigoCadastrado[];
}

async function carregarRegras(repo: RepositorioRomaneio): Promise<Regras> {
  const [filiais, codigos] = await Promise.all([repo.filiaisProprias(), repo.codigos()]);
  return {
    filiaisProprias: filiais.map((f) => f.sigla),
    cadastro: criarCadastro(codigos),
    codigos,
  };
}

const naoVazio = <T>(lista: readonly T[] | undefined): readonly T[] | null =>
  lista && lista.length > 0 ? lista : null;

/** Recorte às filiais próprias. Com siglas dadas e nenhuma própria: nada casa (Q10). */
function recortarAsProprias(siglas: readonly string[] | undefined, proprias: readonly string[]) {
  const dadas = naoVazio(siglas);
  if (!dadas) return { siglas: null, vazio: false };
  const recorte = dadas.map((s) => s.toUpperCase()).filter((s) => proprias.includes(s));
  return { siglas: recorte, vazio: recorte.length === 0 };
}

const padroesDe = (texto: string | undefined) =>
  texto && texto.trim() !== "" ? padroesTextoFiltro(texto) : null;

/** Normaliza os filtros da tela; nulo = o resultado é vazio sem precisar consultar. */
export function normalizarFiltros(
  f: FiltrosRomaneio,
  filiaisProprias: readonly string[],
): FiltrosNormalizados | null {
  if (filiaisProprias.length === 0) return null;
  const filiais = recortarAsProprias(f.filiais, filiaisProprias);
  const unidadeAtual = recortarAsProprias(f.unidadeAtual, filiaisProprias);
  if (filiais.vazio || unidadeAtual.vazio) return null;
  return {
    campo: f.campo,
    periodo: { inicio: f.inicio, fim: f.fim },
    filiaisProprias,
    unidades: naoVazio(f.unidades),
    pagadores: naoVazio(f.parceiros?.map((p) => p.replace(/\D/g, "")).filter((p) => p !== "")),
    filiais: filiais.siglas,
    unidadeAtual: unidadeAtual.siglas,
    remetente: padroesDe(f.remetente),
    destino: padroesDe(f.destino),
    previsao: f.previsao ?? null,
    codigos: naoVazio(f.codigos),
    placas: naoVazio(f.placas?.map(normPlaca).filter((p) => p !== null)),
    motoristas: naoVazio(f.motoristas?.map(normNome).filter((m) => m !== null)),
    tipos: naoVazio(f.tipos?.map((t) => t.trim().toUpperCase())),
  };
}

/** Ocorrências que alguma regra do Romaneio consulta (o resto não precisa sair do banco). */
function codigosQueContam(regras: Regras, filtros: FiltrosNormalizados): number[] {
  const pendencias = regras.codigos.filter((c) => ehTipoPendencia(c.tipoSsw)).map((c) => c.codigo);
  return [
    ...new Set([
      ...CODIGOS_ROTA,
      CODIGO_SAIDA,
      CODIGO_RETORNO,
      ...pendencias,
      ...codigosPrejuizo(filtros.codigos),
    ]),
  ];
}

type Item<F extends FatoCte = FatoDaLista> = ItemDaLista<F>;

interface Base {
  regras: Regras;
  filtros: FiltrosNormalizados;
  itens: Item[];
}

type ExtraDaConsulta = Partial<Omit<ConsultaDeCtes, "filtros">>;

/** CT-e do período com os filtros da barra, já analisados. Nulo = nada casa. */
async function base(
  repo: RepositorioRomaneio,
  f: FiltrosRomaneio,
  extra: ExtraDaConsulta = {},
): Promise<Base | null> {
  const regras = await carregarRegras(repo);
  const filtros = normalizarFiltros(f, regras.filiaisProprias);
  if (!filtros) return null;
  const fatos = await repo.ctes({
    filtros,
    ctrc: null,
    nf: null,
    busca: null,
    ajudantes: null,
    ids: null,
    codigosOcorrencia: codigosQueContam(regras, filtros),
    ...extra,
  });
  const ctx = {
    cadastro: regras.cadastro,
    codigosPrejuizo: codigosPrejuizo(filtros.codigos),
    periodo: filtros.periodo,
    campo: filtros.campo,
  };
  return {
    regras,
    filtros,
    itens: fatos.map((fato) => ({ fato, analise: analisarCte(fato, ctx) })),
  };
}

function contextoPorViagem(b: Base): ContextoPorViagem {
  return {
    cadastro: b.regras.cadastro,
    codigosPrejuizo: codigosPrejuizo(b.filtros.codigos),
    periodo: b.filtros.periodo,
  };
}

/** Viagens de cada CT-e da base (recortadas pelo período de saída e por placa/motorista). */
async function comViagens(repo: RepositorioRomaneio, b: Base): Promise<CteComViagens[]> {
  const viagens = await repo.viagens(
    b.itens.map((i) => i.fato.id),
    {
      saidaEntre: b.filtros.campo === "saida" ? b.filtros.periodo : null,
      placas: b.filtros.placas,
      motoristas: b.filtros.motoristas,
    },
  );
  return b.itens.map((i) => ({ ...i, viagens: viagens.get(i.fato.id) ?? [] }));
}

const temFiltroDeViagem = (f: FiltrosNormalizados) => f.placas !== null || f.motoristas !== null;

// ---------------------------------------------------------------------------------------------
// Aba Hoje

async function ctesDoDia(repo: RepositorioRomaneio, linhas: readonly Linha036[], regras: Regras) {
  const numeros = [
    ...new Set(linhas.map((l) => ctrcDigitado(l.ctrc ?? "").numero).filter((n) => n !== "")),
  ];
  const fp = new Set(regras.filiaisProprias);
  const gravados = await repo.ctesDoDia(numeros, [CODIGO_SAIDA, ...codigosPrejuizo(null)]);
  return gravados.map(({ unidadeDestino, unidadeAtual, filial, ...c }): CteDoDia => ({
    ...c,
    unidadeResponsavel: unidadeResponsavel(fp, { unidadeDestino, unidadeAtual, filial }),
  }));
}

const filtrosDoDia = (
  dia: string,
  e: { filiais?: string[] | undefined; tipos?: string[] | undefined },
) => ({
  dia,
  filiais: naoVazio(e.filiais?.map((s) => s.toUpperCase())),
  tipos: naoVazio(e.tipos),
});

/**
 * Romaneios emitidos hoje (dia de Brasília). Código de prejuízo fixo 13.
 * origem: romaneio_do_dia
 */
export async function obterHoje(
  db: Db,
  ctx: ContextoRomaneio,
  entrada: Entrada<"hoje">,
  agora: Date,
): Promise<Saida<"hoje">> {
  const dia = hojeNoFuso(ctx.fuso, agora);
  return db(async ({ romaneio }) => {
    const regras = await carregarRegras(romaneio);
    const linhas = await romaneio.linhas036DoDia(dia);
    const ctes = await ctesDoDia(romaneio, linhas, regras);
    const r = romaneioDoDia(
      linhas,
      ctes,
      filtrosDoDia(dia, entrada),
      regras.cadastro,
      codigosPrejuizo(null),
    );
    const tipos = [...new Set(ctes.map((c) => c.tipoDocumento?.trim().toUpperCase() || SEM_TIPO))]
      .filter((t) => t !== SEM_TIPO)
      .sort(COLLATOR.compare);
    return { dia, ...r, tipos };
  });
}

/** CT-e do dia numa faixa de prazo (gaveta da aba Hoje). origem: romaneio_do_dia_ctrcs */
export async function obterCtesDoDia(
  db: Db,
  ctx: ContextoRomaneio,
  entrada: Entrada<"hojeCtes">,
  agora: Date,
): Promise<Saida<"hojeCtes">> {
  const dia = hojeNoFuso(ctx.fuso, agora);
  return db(async ({ romaneio }) => {
    const regras = await carregarRegras(romaneio);
    const linhas = await romaneio.linhas036DoDia(dia);
    const ctes = await ctesDoDia(romaneio, linhas, regras);
    const r = ctesDaFaixa(
      linhas,
      ctes,
      filtrosDoDia(dia, entrada),
      entrada.faixa,
      entrada.apenasNaoEntregues,
      regras.cadastro,
    );
    return { ...r, limite: LIMITE_DA_GAVETA };
  });
}

const LIMITE_DA_GAVETA = 2000;

// ---------------------------------------------------------------------------------------------
// Cards do topo e lista (aba Total)

/** CT-e/NF digitados. `vazio` = digitou algo que não casa com CT-e nenhum. */
function documento(e: { ctrc?: string | undefined; nf?: string | undefined }) {
  const ctrc = e.ctrc?.trim() ? ctrcDigitado(e.ctrc) : null;
  const nf = e.nf?.trim() ? nfDigitada(e.nf) : null;
  const vazio = (ctrc !== null && ctrc.numero === "") || (!!e.nf?.trim() && nf === null);
  return { ctrc, nf, vazio };
}

/**
 * Cards do topo. Sem recorte, sem "Em rota agora" e sem "só em andamento".
 * origem: get_romaneio_base_totais
 */
export async function obterTotais(
  db: Db,
  ctx: ContextoRomaneio,
  e: Entrada<"totais">,
  agora: Date,
): Promise<Saida<"totais">> {
  const hoje = hojeNoFuso(ctx.fuso, agora);
  return db(async ({ romaneio }) => {
    const config = await romaneio.configuracoes(["otif_visivel", CONFIG.diasSemMovimento.chave]);
    const otifVisivel = config.get("otif_visivel") === "true";
    const doc = documento(e);
    const b = doc.vazio
      ? null
      : await base(romaneio, e.filtros, {
          ctrc: doc.ctrc,
          nf: doc.nf,
          ...(e.semMovimento ? { codigosOcorrencia: null } : {}),
        });
    const dias = numeroDaConfiguracao(config, CONFIG.diasSemMovimento);
    const itens = (b?.itens ?? []).filter(
      (i) => !e.semMovimento || estaSemMovimento(i.fato, i.analise, dias, agora),
    );
    const cadastro = b?.regras.cadastro ?? criarCadastro([]);
    return { totais: totaisDoTopo(itens, e.universo, cadastro, hoje), otifVisivel };
  });
}

type FiltrosDaLista = Pick<
  Entrada<"lista">,
  "filtros" | "ctrc" | "nf" | "busca" | "recorte" | "emRotaAgora" | "status" | "semMovimento"
>;

/** A base com os filtros próprios da lista (Em rota agora, status, sem movimento, recorte). */
async function filtrarLista(
  romaneio: RepositorioRomaneio,
  e: FiltrosDaLista,
  hoje: string,
  agora: Date,
  ids: readonly string[] | null,
): Promise<{ itens: Item[]; regras: Regras } | null> {
  const doc = documento(e);
  if (doc.vazio) return null;
  const b = await base(romaneio, e.filtros, {
    ctrc: doc.ctrc,
    nf: doc.nf,
    busca: e.busca?.trim() || null,
    ids,
    ...(e.semMovimento ? { codigosOcorrencia: null } : {}),
  });
  if (!b) return null;
  const config = await romaneio.configuracoes([CONFIG.diasSemMovimento.chave]);
  const dias = numeroDaConfiguracao(config, CONFIG.diasSemMovimento);
  const itens = b.itens.filter((item) =>
    casaFiltrosDaLista(item, e, { diasSemMovimento: dias, agora, hoje }),
  );
  return { itens, regras: b.regras };
}

const FONTES = ["bi2_0174", "bi2_0013", "webhook"] as const;
const ehFonte = (f: string | null | undefined): f is (typeof FONTES)[number] =>
  FONTES.some((x) => x === f);

function linhaDaLista(
  { fato: f, analise: a }: Item,
  d: DetalheDaLinha | undefined,
  cadastro: Cadastro,
): LinhaLista {
  const codigo = normCodigoOcorr(f.ocorrEfetivaCodigo);
  const fonte = d?.ocorrEfetivaFonte;
  return {
    id: f.id,
    sigla: f.sigla,
    numero: f.numero,
    numeroNf: f.numeroNf,
    dataEmissao: f.dataEmissao,
    dataEmbarque: f.dataEmbarque,
    dataPrevista: f.dataPrevista,
    dataEntregaRealizada: f.dataEntregaRealizada?.toISOString() ?? null,
    parceiroId: f.parceiroId,
    parceiroNome: f.parceiroNome,
    unidadeId: f.unidadeId,
    filial: f.filial,
    unidadeCidade: d?.unidadeCidade ?? null,
    unidadeUf: d?.unidadeUf ?? null,
    unidadeAtual: d?.unidadeAtual ?? null,
    placa: d?.placa ?? null,
    motorista: d?.motorista ?? null,
    remetente: f.remetente,
    destinatario: d?.destinatario ?? null,
    cidadeDestino: f.cidadeDestino,
    ufDestino: f.ufDestino,
    setor: f.setor,
    bairro: d?.bairro ?? null,
    endereco: d?.endereco ?? null,
    valorMercadoria: d?.valorMercadoria ?? null,
    peso: f.peso,
    volumes: f.volumes,
    valorFrete: f.valorFrete,
    tde: f.tde,
    statusAtual: f.statusAtual,
    ultimaOcorrencia:
      codigo === null
        ? null
        : {
            codigo,
            descricao: d?.ocorrEfetivaDescricao || cadastro.codigo(codigo)?.descricao || null,
            dataHora: d?.ocorrEfetivaData?.toISOString() ?? null,
            fonte: ehFonte(fonte) ? fonte : null,
          },
    baixadoSemEntrega: a.finalizado,
    emRotaAgora: a.emRotaAgora,
    atrasoDias: d?.atrasoDias ?? null,
    performanceDias: d?.performanceDias ?? null,
    responsabilidadeCliente: d?.responsabilidadeCliente ?? null,
  };
}

async function limitesDeCarga(romaneio: RepositorioRomaneio) {
  const config = await romaneio.configuracoes([
    CONFIG.pesoCritico.chave,
    CONFIG.volumeCritico.chave,
  ]);
  return {
    pesoKg: numeroDaConfiguracao(config, CONFIG.pesoCritico),
    volumes: numeroDaConfiguracao(config, CONFIG.volumeCritico),
  };
}

/**
 * Lista da aba Total: filtros, recorte (mesma regra do card — Q13), ordem pela coluna (Q03) e
 * página. Com agrupamento, até 2000 linhas sem paginação (Q04).
 * origem: get_romaneio_v3 + getRomaneio (sistema atual)
 */
export async function obterLista(
  db: Db,
  ctx: ContextoRomaneio,
  e: Entrada<"lista">,
  agora: Date,
): Promise<Saida<"lista">> {
  const hoje = hojeNoFuso(ctx.fuso, agora);
  return db(async ({ romaneio }) => {
    const limites = await limitesDeCarga(romaneio);
    const r = await filtrarLista(romaneio, e, hoje, agora, null);
    const itens = r?.itens ?? [];
    const { totais, grupos } = resumirLista(itens, e.agrupar);
    const pagina = paginaDaLista(itens, e);
    const detalhes = await romaneio.detalhes(pagina.map((i) => i.fato.id));
    const porId = new Map(detalhes.map((d) => [d.id, d]));
    const cadastro = r?.regras.cadastro ?? criarCadastro([]);
    return {
      linhas: pagina.map((i) => linhaDaLista(i, porId.get(i.fato.id), cadastro)),
      total: totais.ctes,
      totais,
      grupos,
      limites,
      hoje,
    };
  });
}

/**
 * Exportação da lista: mesmos filtros e recorte da tela, ordem por emissão (mais nova primeiro),
 * até 10.000 linhas; "somente as marcadas" vai por ids, "todas" tira as desmarcadas.
 * origem: exportacao.functions.ts (tela romaneio, sistema atual)
 */
export async function exportarLista(
  db: Db,
  ctx: ContextoRomaneio,
  e: Entrada<"exportar">,
  agora: Date,
): Promise<Saida<"exportar">> {
  const hoje = hojeNoFuso(ctx.fuso, agora);
  return db(async ({ romaneio }) => {
    const limites = await limitesDeCarga(romaneio);
    const somente = e.selecao.modo === "somente";
    if (somente && e.selecao.ids.length === 0) return { linhas: [], limites, hoje };
    const r = await filtrarLista(romaneio, e, hoje, agora, somente ? e.selecao.ids : null);
    const desmarcadas = new Set(somente ? [] : e.selecao.ids);
    const itens = ordenarLista(r?.itens ?? [], "data_emissao", "desc")
      .filter((i) => !desmarcadas.has(i.fato.id))
      .slice(0, LIMITE_EXPORTACAO);
    const detalhes = await romaneio.detalhes(itens.map((i) => i.fato.id));
    const porId = new Map(detalhes.map((d) => [d.id, d]));
    const cadastro = r?.regras.cadastro ?? criarCadastro([]);
    const linhas = itens.map((i): LinhaExportada => {
      const d = porId.get(i.fato.id);
      return {
        ...linhaDaLista(i, d, cadastro),
        pagador: i.fato.pagadorNome,
        cep: d?.cep ?? null,
        placaColeta: d?.placaColeta ?? null,
        placaEntrega: d?.placaEntrega ?? null,
      };
    });
    return { linhas, limites, hoje };
  });
}

// ---------------------------------------------------------------------------------------------
// Demais abas (filtros da barra, sem documento nem recorte)

/** Distribuição dos não finalizados por código. origem: romaneio_distribuicao_codigos */
export async function obterDistribuicao(db: Db, e: Entrada<"distribuicao">) {
  return db(async ({ romaneio }) => {
    const b = await base(romaneio, e.filtros);
    return b ? distribuicaoDosNaoFinalizados(b.itens, b.regras.cadastro) : [];
  });
}

/** origem: romaneio_kpis */
export async function obterKpis(db: Db, e: Entrada<"kpis">) {
  return db(async ({ romaneio }) => kpisDoRomaneio((await base(romaneio, e.filtros))?.itens ?? []));
}

/** origem: romaneio_notas_por_carro */
export async function obterCtesPorCarro(db: Db, e: Entrada<"ctesPorCarro">) {
  return db(async ({ romaneio }) => {
    const b = await base(romaneio, e.filtros);
    return b ? ctesPorCarro(await comViagens(romaneio, b)) : [];
  });
}

/** origem: romaneio_por_viagem */
export async function obterPorViagem(db: Db, e: Entrada<"porViagem">) {
  return db(async ({ romaneio }) => {
    const b = await base(romaneio, e.filtros);
    if (!b) return [];
    const itens = (await comViagens(romaneio, b)).filter((i) => i.viagens.length > 0);
    return porViagem(itens, contextoPorViagem(b), e.busca ?? null);
  });
}

/** origem: romaneio_performance_motorista */
export async function obterPerformanceMotoristas(
  db: Db,
  ctx: ContextoRomaneio,
  e: Entrada<"performanceMotoristas">,
) {
  return db(async ({ romaneio }) => {
    const b = await base(romaneio, e.filtros);
    if (!b) return [];
    const [itens, equipes] = await Promise.all([
      comViagens(romaneio, b),
      romaneio.motoristasDeEquipe(),
    ]);
    return performanceMotorista(itens, contextoPorViagem(b), equipes, {
      verPlaca: ctx.verPlaca,
      exigeViagem: temFiltroDeViagem(b.filtros),
    });
  });
}

/** origem: romaneio_performance_ajudante */
export async function obterPerformanceAjudantes(
  db: Db,
  ctx: ContextoRomaneio,
  e: Entrada<"performanceAjudantes">,
) {
  return db(async ({ romaneio }) => {
    const b = await base(romaneio, e.filtros);
    if (!b) return [];
    const ajudantes = naoVazio(e.filtros.ajudantes?.map((a) => a.trim().toUpperCase()));
    return performanceAjudante(
      await comViagens(romaneio, b),
      contextoPorViagem(b),
      ajudantes,
      ctx.verPlaca,
    );
  });
}

/** origem: romaneio_performance_carro */
export async function obterPerformanceCarros(db: Db, e: Entrada<"performanceCarros">) {
  return db(async ({ romaneio }) => {
    const b = await base(romaneio, e.filtros);
    if (!b) return [];
    return performanceCarro(
      await comViagens(romaneio, b),
      contextoPorViagem(b),
      temFiltroDeViagem(b.filtros),
    );
  });
}

const PREJUIZO_VAZIO: Saida<"prejuizo"> = {
  porDia: [],
  porHora: [],
  cidades: [],
  pagadores: [],
  motoristas: [],
};

/** origem: get_romaneio_prejuizo (janela do período — Q14) */
export async function obterPrejuizo(db: Db, e: Entrada<"prejuizo">): Promise<Saida<"prejuizo">> {
  return db(async ({ romaneio }) => {
    const b = await base(romaneio, e.filtros);
    return b ? prejuizo(await comViagens(romaneio, b), contextoPorViagem(b)) : PREJUIZO_VAZIO;
  });
}

/**
 * Motivos de não entrega. Filtro de ajudante pelo último romaneio do CT-e.
 * origem: romaneio_motivos_nao_entrega
 */
export async function obterMotivos(db: Db, e: Entrada<"motivos">) {
  return db(async ({ romaneio }) => {
    const ajudantes = naoVazio(e.filtros.ajudantes?.map((a) => a.trim().toUpperCase()));
    const b = await base(romaneio, e.filtros, { ajudantes });
    return b
      ? motivosDeNaoEntrega(
          b.itens.map((i) => i.fato),
          b.regras.cadastro,
          e.limite,
        )
      : [];
  });
}

/**
 * Opções da barra de filtros: placas/motoristas encadeados (sempre pela data de saída),
 * pagadores e tipos do período, filiais próprias, "Local. atual" e códigos.
 * origem: romaneio_opcoes_placa_motorista, listar_pagadores_ctrcs, tipos_documento_no_periodo
 */
export async function obterOpcoes(db: Db, e: Entrada<"opcoes">): Promise<Saida<"opcoes">> {
  return db(async ({ romaneio }) => {
    const periodo = { inicio: e.inicio, fim: e.fim };
    const [filiais, codigos, config] = await Promise.all([
      romaneio.filiaisProprias(),
      romaneio.codigos(),
      romaneio.configuracoes([LOCAIS_ATUAIS.chave]),
    ]);
    const placas = naoVazio(e.placas?.map(normPlaca).filter((p) => p !== null));
    const motoristas = naoVazio(e.motoristas?.map(normNome).filter((m) => m !== null));
    const [placaMotorista, pagadoresETipos] = await Promise.all([
      romaneio.opcoesPlacaMotorista(periodo, placas, motoristas),
      romaneio.pagadoresETipos(
        e.campo,
        periodo,
        filiais.map((f) => f.sigla),
      ),
    ]);
    const locais = config
      .get(LOCAIS_ATUAIS.chave)
      ?.split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s !== "");
    return {
      ...placaMotorista,
      ...pagadoresETipos,
      filiais,
      locaisAtuais: locais && locais.length > 0 ? locais : [...LOCAIS_ATUAIS.padrao],
      codigos: codigos
        .map((c) => ({ codigo: c.codigo, descricao: c.descricao }))
        .sort((a, b) => a.codigo - b.codigo),
    };
  });
}

/** Linha do tempo do CT-e (sigla + número — Q02). origem: romaneio_timeline_ocorrencias */
export async function obterLinhaDoTempo(
  db: Db,
  sigla: string,
  numero: string,
): Promise<Saida<"linhaDoTempo">> {
  return db(async ({ romaneio }) => {
    const { ocorrencias, linhas930 } = await romaneio.linhaDoTempo(sigla, numero);
    return linhaDoTempo(ocorrencias, linhas930).map((ev) => ({
      ...ev,
      dataHora: ev.dataHora.toISOString(),
    }));
  });
}
