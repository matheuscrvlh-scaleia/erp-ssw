import { type Periodo, PERIODOS } from "@erp/dominio/performance/tela";
import { type BaseDeData, BASES_DE_DATA } from "@erp/shared/contratos/performance";
import { defaultStringifySearch } from "@tanstack/react-router";

/** Parâmetros da URL de /performance (os mesmos de hoje). */
export interface BuscaPerformance {
  periodo: Periodo;
  base: BaseDeData;
  unidades: string[];
  parceiros: string[];
  ordem: "pior" | "melhor";
  remetente: string;
  destino: string;
  filiais: string[];
  codigos: string[];
  tipos: string[];
  de: string;
  ate: string;
}

export const ROTULO_DA_BASE: Record<BaseDeData, string> = {
  emissao: "Emitidos",
  prevista: "Data Prevista",
  concluido: "Concluídos",
};
export const DICA_DA_BASE: Record<BaseDeData, string> = {
  emissao: "O período filtra pela data de emissão do CT-e.",
  prevista: "O período filtra pela data prevista de entrega.",
  concluido: "O período filtra pela data de entrega ou de baixa no sistema.",
};
export const DATA_DA_BASE: Record<BaseDeData, string> = {
  emissao: "Emissão",
  prevista: "Prevista",
  concluido: "Concluído",
};
export const BASE_CURTA: Record<BaseDeData, string> = {
  emissao: "por data de emissão",
  prevista: "por data prevista",
  concluido: "por data de conclusão",
};

const DIA = /^\d{4}-\d{2}-\d{2}$/;

function lista(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return typeof v === "string" && v.length > 0 ? [v] : [];
}

const texto = (v: unknown): string => (typeof v === "string" ? v : "");
const dia = (v: unknown): string => (typeof v === "string" && DIA.test(v) ? v : "");

/** Lê a URL com os mesmos padrões de hoje (período "mes", base "emissao", ordem "pior"). */
export function validarBusca(bruta: Record<string, unknown>): BuscaPerformance {
  const periodo = PERIODOS.find((p) => p === bruta["periodo"]) ?? "mes";
  const base = BASES_DE_DATA.find((b) => b === bruta["base"]) ?? "emissao";
  return {
    periodo,
    base,
    unidades: lista(bruta["unidades"]),
    parceiros: lista(bruta["parceiros"]),
    ordem: bruta["ordem"] === "melhor" ? "melhor" : "pior",
    remetente: texto(bruta["remetente"]),
    destino: texto(bruta["destino"]),
    filiais: lista(bruta["filiais"]),
    codigos: lista(bruta["codigos"]),
    tipos: lista(bruta["tipos"]),
    de: dia(bruta["de"]),
    ate: dia(bruta["ate"]),
  };
}

/** Filtros da tela (sem o período), no formato dos contratos. Lista vazia = sem filtro. */
export interface FiltrosDaTela {
  unidades: string[] | null;
  parceiros: string[] | null;
  remetente: string | null;
  destino: string | null;
  filiais: string[] | null;
  codigos: string[] | null;
  tipos: string[] | null;
}

const ouNulo = (l: string[]) => (l.length > 0 ? l : null);

export function filtrosDaBusca(b: BuscaPerformance): FiltrosDaTela {
  return {
    unidades: ouNulo(b.unidades),
    parceiros: ouNulo(b.parceiros),
    remetente: b.remetente || null,
    destino: b.destino || null,
    filiais: ouNulo(b.filiais),
    codigos: ouNulo(b.codigos),
    tipos: ouNulo(b.tipos),
  };
}

export function temFiltroLimpavel(b: BuscaPerformance): boolean {
  return Boolean(
    b.remetente ||
    b.destino ||
    b.filiais.length ||
    b.codigos.length ||
    b.tipos.length ||
    b.de ||
    b.ate,
  );
}

/** "Limpar filtros": mantém unidades, parceiros, ordem e período pré-definido (como hoje). */
export function limparFiltros(b: BuscaPerformance): BuscaPerformance {
  return {
    ...b,
    remetente: "",
    destino: "",
    filiais: [],
    codigos: [],
    tipos: [],
    de: "",
    ate: "",
    periodo: b.periodo === "custom" ? "mes" : b.periodo,
  };
}

export type TipoDaLista =
  | "emitidos"
  | "entregues"
  | "no_prazo"
  | "fora_prazo"
  | "sem_movimento"
  | "penalizados"
  | "penalizados_abertos"
  | "em_atraso"
  | "em_atraso_fr"
  | "em_atraso_cliente"
  | "finalizado_sistema"
  | "previstos_por_status"
  | "previstos_por_faixa"
  | "vencimento_proximo"
  | "nascido_atrasado"
  | "nascido_em_atraso"
  | "otif"
  | "sem_atualizacao"
  | "ocorrencia_13"
  | "ocorrencia_13_multipla"
  | "tde_aguardando";

export interface ExtraDaLista {
  unidades?: string[];
  statusPrevisto?: string | null;
  faixaPrev?: string | null;
  ignorarPeriodo?: boolean;
  ctrc?: string;
  nf?: string;
  abertos?: boolean;
  /** Alertas operacionais e Previstos vão sempre por emissão. */
  base?: BaseDeData;
}

/**
 * Endereço da Listagem detalhada com os filtros da tela (mesmos parâmetros de hoje). Códigos vão
 * como números; nulos e vazios ficam fora da URL.
 */
export function enderecoDaLista(b: BuscaPerformance, tipo: TipoDaLista, extra: ExtraDaLista = {}) {
  const codigos = b.codigos.map(Number).filter((n) => Number.isInteger(n));
  const busca: Record<string, unknown> = {
    tipo,
    status_previsto: extra.statusPrevisto ?? undefined,
    faixa_prev: extra.faixaPrev ?? undefined,
    ignorar_periodo: extra.ignorarPeriodo ? "1" : undefined,
    ctrc: extra.ctrc,
    nf: extra.nf,
    periodo: b.periodo,
    base: extra.base ?? b.base,
    de: b.de,
    ate: b.ate,
    unidades: extra.unidades ?? b.unidades,
    filiais: b.filiais,
    parceiros: b.parceiros,
    remetente: b.remetente,
    destino: b.destino,
    codigos,
    tipos: b.tipos,
    abertos: extra.abertos ? "1" : undefined,
  };
  const limpa = Object.fromEntries(
    Object.entries(busca).filter(
      ([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0),
    ),
  );
  return `/performance/lista${defaultStringifySearch(limpa)}`;
}
