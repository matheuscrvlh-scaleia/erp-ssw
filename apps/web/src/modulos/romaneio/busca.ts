/**
 * Filtros da tela Romaneio na URL — os mesmos parâmetros de hoje (`/romaneio?periodo=…&ver=…`),
 * inclusive os singulares antigos (`codigo`, `placa`, `motorista`, `ajudante`).
 */
import {
  AGRUPAMENTOS,
  type CampoData,
  CAMPOS_DATA,
  type FiltrosRomaneio,
  ORDENS,
  type Recorte,
  RECORTES,
  TAMANHOS_DE_PAGINA,
} from "@erp/shared/contratos/romaneio";
import { z } from "@erp/shared/zod";

import { ATALHOS_PERIODO, type Intervalo } from "@/componentes/comum/periodo";
import { campoFiltro } from "@/hooks/use-filtros-na-url";

export const ABAS = [
  "hoje",
  "andamento",
  "romaneio",
  "performance",
  "motoristas",
  "ajudantes",
  "prejuizo",
] as const;
export type Aba = (typeof ABAS)[number];

/** Os atalhos do kit + intervalo personalizado. */
const PERIODOS = [...ATALHOS_PERIODO, "custom"] as const;

/** Liga/desliga que a URL de hoje grava como 0/1. */
const umOuZero = z
  .union([z.number(), z.string(), z.boolean()])
  .transform((v) => v === true || Number(v) === 1)
  .catch(false);

export const esquemaRomaneio = z.object({
  tab: campoFiltro.opcao(ABAS, "hoje"),
  periodo: campoFiltro.opcao(PERIODOS, "mes"),
  de: campoFiltro.data(),
  ate: campoFiltro.data(),
  ver: campoFiltro.opcao(CAMPOS_DATA, "saida"),
  unidades: campoFiltro.lista(),
  parceiros: campoFiltro.lista(),
  filiais: campoFiltro.lista(),
  unidadeAtual: campoFiltro.lista(),
  remetente: campoFiltro.texto(500),
  destino: campoFiltro.texto(500),
  codigos: campoFiltro.lista(),
  codigo: campoFiltro.texto(10),
  tipos: campoFiltro.lista(),
  previsao: campoFiltro.data(),
  placas: campoFiltro.lista(),
  placa: campoFiltro.texto(20),
  motoristas: campoFiltro.lista(),
  motorista: campoFiltro.texto(200),
  ajudantes: campoFiltro.lista(),
  ajudante: campoFiltro.texto(200),
  ctrc: campoFiltro.texto(40),
  nf: campoFiltro.texto(40),
  busca: campoFiltro.texto(120),
  recorte: campoFiltro.opcao(RECORTES, "todos"),
  /** Filtro "Em rota agora" da lista. */
  romaneado: campoFiltro.opcao(["todos", "sim", "nao"], "todos"),
  status: campoFiltro.opcao(["todos", "andamento"], "todos"),
  verTodos: umOuZero,
  semMovimento: umOuZero,
  agrupar: campoFiltro.opcao(AGRUPAMENTOS, "none"),
  /** Sem coluna clicada: previsão crescente (a ordem de hoje). */
  ordem: z.enum(ORDENS).optional().catch(undefined),
  dir: campoFiltro.opcao(["asc", "desc"], "asc"),
  page: campoFiltro.pagina(),
  size: z.coerce
    .number()
    .refine((n) => TAMANHOS_DE_PAGINA.some((t) => t === n))
    .catch(50),
});
export type BuscaRomaneio = z.output<typeof esquemaRomaneio>;
export type TamanhoDePagina = (typeof TAMANHOS_DE_PAGINA)[number];

export const tamanhoDePagina = (n: number): TamanhoDePagina =>
  TAMANHOS_DE_PAGINA.find((t) => t === n) ?? 50;

const unicos = (valores: readonly string[]) => [...new Set(valores.filter((v) => v !== ""))];

/** Lista + singular antigo (`?placa=X` de links salvos). */
export const comSingular = (lista: readonly string[], singular: string) =>
  unicos([...lista, singular]);

/** Códigos de ocorrência (`codigos` + `codigo` antigo), só os números válidos. */
export function codigosDaBusca(b: Pick<BuscaRomaneio, "codigos" | "codigo">): number[] {
  const numeros = [...b.codigos, b.codigo]
    .filter((c) => c.trim() !== "")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 99);
  return [...new Set(numeros)].sort((a, b) => a - b);
}

type ChaveDeLista =
  | "unidades"
  | "parceiros"
  | "filiais"
  | "unidadeAtual"
  | "placas"
  | "motoristas"
  | "ajudantes"
  | "tipos";

/**
 * Filtros da barra do topo, comuns a todas as abas menos Hoje. Motorista vale em todas menos
 * Performance Ajudante; Ajudante só nela (o filtro escondido de uma aba não pesa na outra).
 */
export function filtrosDaBarra(b: BuscaRomaneio, intervalo: Intervalo): FiltrosRomaneio {
  const filtros: FiltrosRomaneio = { campo: b.ver, inicio: intervalo.inicio, fim: intervalo.fim };
  const lista = (chave: ChaveDeLista, valores: readonly string[]) => {
    if (valores.length > 0) filtros[chave] = [...valores];
  };
  lista("unidades", b.unidades);
  lista("parceiros", b.parceiros);
  lista("filiais", b.filiais);
  lista("unidadeAtual", b.unidadeAtual);
  lista("placas", comSingular(b.placas, b.placa));
  lista("tipos", b.tipos);
  // O filtro escondido de uma aba não pesa na outra.
  if (b.tab === "ajudantes") lista("ajudantes", comSingular(b.ajudantes, b.ajudante));
  else lista("motoristas", comSingular(b.motoristas, b.motorista));
  if (b.remetente.trim()) filtros.remetente = b.remetente;
  if (b.destino.trim()) filtros.destino = b.destino;
  if (b.previsao) filtros.previsao = b.previsao;
  const codigos = codigosDaBusca(b);
  if (codigos.length > 0) filtros.codigos = codigos;
  return filtros;
}

/**
 * Visão padrão: só o que saiu (entregues + em rota + baixados + travados). "Ver todos os CTRC"
 * devolve o universo inteiro, com os parados. Pela data de saída tudo já saiu por definição.
 */
export const veTodos = (b: Pick<BuscaRomaneio, "verTodos" | "ver">) =>
  b.verTodos || b.ver === "saida";

export function recorteEfetivo(b: Pick<BuscaRomaneio, "verTodos" | "ver" | "recorte">): Recorte {
  if (b.recorte !== "todos") return b.recorte;
  return veTodos(b) ? "todos" : "romaneados";
}

/** Texto da base de data escolhida (seletor "Contar as cargas pela" e dica do período). */
export function baseAtual(ver: CampoData): { curto: string; ajuda: string; texto: string } {
  switch (ver) {
    case "saida":
      return {
        curto: "por data de saída para entrega",
        ajuda: "dia em que o CTRC saiu no romaneio",
        texto:
          "O período filtra pelo dia em que o CTRC saiu para entrega no romaneio, em todas as abas desta tela.",
      };
    case "conclusao":
      return {
        curto: "por data de conclusão",
        ajuda: "dia em que a carga foi concluída",
        texto:
          "O período filtra pelo dia da conclusão da carga (entrega ou outro encerramento), em todas as abas desta tela.",
      };
    case "embarque":
      return {
        curto: "por data de embarque",
        ajuda: "data de embarque",
        texto: "O período filtra pela data de embarque.",
      };
    case "prevista":
      return {
        curto: "por data prevista",
        ajuda: "data prevista de entrega",
        texto: "O período filtra pela data prevista de entrega.",
      };
    case "emissao":
      return {
        curto: "por data de emissão",
        ajuda: "data de emissão do CT-e",
        texto: "O período filtra pela data de emissão do CT-e, em todas as abas desta tela.",
      };
  }
}

/** Clique num card/linha das abas: abre a lista da aba Total com esse recorte. */
export interface Abertura {
  recorte?: Recorte;
  status?: "andamento";
  codigos?: number[];
  placa?: string;
  motorista?: string;
}

export function buscaDaAbertura(a: Abertura): Partial<BuscaRomaneio> {
  return {
    tab: "andamento",
    recorte: a.recorte ?? "todos",
    romaneado: "todos",
    status: a.status ?? "todos",
    ...(a.codigos ? { codigos: a.codigos.map(String), codigo: "" } : {}),
    ...(a.placa ? { placas: [a.placa], placa: "" } : {}),
    ...(a.motorista ? { motoristas: [a.motorista], motorista: "" } : {}),
    page: 1,
  };
}

export const ROTULO_RECORTE: Record<Recorte, string> = {
  todos: "Todos",
  entregues: "Entregues",
  em_rota: "Em rota de entrega",
  devolvido: "Baixado sem entrega",
  travado: "Travado em ocorrência",
  parado: "Parado, sem saída para entrega",
  romaneados: "Somente romaneados (saíram para entrega)",
  otif: "CTRC com problema no percurso",
  prejuizo: "CTRC com prejuízo",
  em_rota_vencida: "Em rota · prazo vencido",
  em_rota_hoje: "Em rota · vence hoje",
  em_rota_futuro: "Em rota · vencimento futuro",
  em_rota_sem_prev: "Em rota · sem prazo definido",
  tde_romaneado: "TDE romaneado (em rota ou entregue)",
};

/** Opções do select "Situação" da lista — mesma ordem dos cards e chips do topo. */
export const RECORTES_DA_LISTA: readonly Recorte[] = [
  "todos",
  "em_rota",
  "entregues",
  "devolvido",
  "travado",
  "parado",
  "otif",
  "prejuizo",
  "em_rota_vencida",
  "em_rota_hoje",
  "em_rota_futuro",
  "em_rota_sem_prev",
  "tde_romaneado",
];

export const ROTULO_EM_ROTA_AGORA = { todos: "Todos", sim: "Sim", nao: "Não" } as const;

export const ROTULO_AGRUPAMENTO = {
  none: "Nenhum",
  parceiro: "Parceiro",
  unidade: "Unidade",
  cidade: "Cidade de destino",
  setor: "Setor de entrega",
} as const;
