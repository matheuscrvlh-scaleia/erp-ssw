import { type PgTable } from "drizzle-orm/pg-core";

import { type ValorJson } from "../transformacoes/json";

/**
 * Uma linha pronta para o destino: **toda** coluna da tabela (nome da propriedade do Drizzle)
 * com valor explícito, para que nenhum default do banco decida em silêncio. Formatos:
 * datas e instantes como o texto que o Postgres devolve; `numeric` e `bigint` em texto;
 * `jsonb` como texto JSON (da origem) ou objeto montado aqui; `text[]` como lista.
 * Coluna de identidade (`generated always`) não entra.
 */
export type LinhaDestino<T extends PgTable> = {
  [K in keyof T["$inferInsert"] & string]-?: ValorJson;
};

export type ColunaDe<T extends PgTable> = keyof LinhaDestino<T> & string;

/** Inclui a coluna de identidade (`generated always`), que não entra no tipo de inserção. */
export type ColunaSelecionavel<T extends PgTable> = keyof T["$inferSelect"] & string;

/** `ajustes`: o que a regra mudou na linha e precisa aparecer no relatório (ex.: senha não levada). */
export type Resultado<L> =
  { tipo: "migrar"; linha: L; ajustes: readonly string[] } | { tipo: "descartar"; motivo: string };

export function migrar<L>(linha: L, ...ajustes: (string | null)[]): Resultado<L> {
  return { tipo: "migrar", linha, ajustes: ajustes.filter((a): a is string => a !== null) };
}

export function descartar(motivo: string): Resultado<never> {
  return { tipo: "descartar", motivo };
}

/**
 * Recorte da execução. Nas consultas, `@empresa` (uuid ou nulo) e `@instante` (timestamptz)
 * viram parâmetros; nunca texto concatenado.
 */
export interface Filtros {
  empresaId: string | null;
  /** Instante da migração (texto do Postgres, UTC), fixado na primeira execução. */
  instante: string;
}

export interface ChaveDeOrigem {
  /** Expressão SQL não nula e única no conjunto (com as demais chaves). */
  expressao: string;
  /** Tipo SQL usado na comparação do keyset (`uuid`, `integer`, `text`, `date`...). */
  tipo: string;
}

/** SELECT da origem, paginado por keyset nas `chave`. */
export interface ConsultaDeOrigem {
  colunas: string;
  de: string;
  onde: readonly string[];
  chave: readonly ChaveDeOrigem[];
}

/** Parâmetro nomeado de SQL: `@nome` no texto vira `$n::tipo`. */
export interface ParametroNomeado {
  valor: unknown;
  tipo: string;
}

export interface Consulta {
  consultar<R extends object>(
    texto: string,
    parametros: Readonly<Record<string, ParametroNomeado>>,
  ): Promise<R[]>;
}

export interface Fontes {
  origem: Consulta;
  destino: Consulta;
}

/**
 * Chave estrangeira conferida no destino antes de gravar: o pai pode não ter migrado (empresa
 * nula, CT-e sem sigla...). `descartar` tira a linha; `anular` zera a coluna e registra o ajuste.
 */
export interface Referencia<T extends PgTable> {
  colunas: readonly ColunaDe<T>[];
  tabela: string;
  colunasDestino: readonly string[];
  tipos: readonly string[];
  seAusente: { descartar: string } | { anular: ColunaDe<T>; motivo: string };
}

export interface DefinicaoDeTabela<O extends object, T extends PgTable, A> {
  /** Nome do passo (`--tabelas`): a tabela de destino, ou `tabela:variante` quando há várias origens. */
  nome: string;
  origem: string;
  tabela: T;
  consulta: ConsultaDeOrigem;
  /** Identificação da linha de origem no relatório (nunca dado sensível). */
  chaveDaLinha: (linha: O) => string;
  /** Carga de apoio feita uma vez por passada (ex.: siglas do 455, mapa de arquivos). */
  preparar: (fontes: Fontes, filtros: Filtros) => Promise<A>;
  transformar: (linha: O, apoio: A, filtros: Filtros) => Resultado<LinhaDestino<T>>;
  /** Chave natural do upsert (idempotência). */
  conflito: readonly ColunaSelecionavel<T>[];
  aoConflitar: "atualizar" | "ignorar";
  /** Keyset da leitura do destino na conferência (padrão: `conflito`). Colunas não nulas. */
  chaveDestino?: readonly ColunaSelecionavel<T>[];
  /** WHERE do destino que delimita o que esta definição escreve (para a conferência). */
  escopoDestino: string;
  referencias: readonly Referencia<T>[];
  /** Colunas que a conferência não compara (ex.: segredo cifrado com IV aleatório). */
  foraDaConferencia?: readonly ColunaDe<T>[];
  /** Preserva o valor da coluna `generated always` da origem (grava com `overriding system value`). */
  identidade?: { coluna: string; valor: (linha: O) => string };
  /** Passo depois de todas as tabelas (ex.: FK adiada). Devolve notas para o relatório. */
  aposMigrar?: (fontes: Fontes & { executor: Executor }, filtros: Filtros) => Promise<string[]>;
}

export interface Executor {
  executar(texto: string, parametros: Readonly<Record<string, ParametroNomeado>>): Promise<number>;
}

/** Definição com os tipos fechados: é o que o registro e o orquestrador manipulam. */
export interface Passo {
  nome: string;
  origem: string;
  destino: string;
  aplicar: (motor: MotorDeTabela) => Promise<void>;
}

/** Visitante que recebe a definição tipada (evita `any` no registro heterogêneo). */
export interface MotorDeTabela {
  executar<O extends object, T extends PgTable, A>(def: DefinicaoDeTabela<O, T, A>): Promise<void>;
}

export function definirTabela<O extends object, T extends PgTable, A>(
  def: DefinicaoDeTabela<O, T, A>,
): Passo & { definicao: DefinicaoDeTabela<O, T, A> } {
  return {
    nome: def.nome,
    origem: def.origem,
    destino: def.nome.split(":")[0] ?? def.nome,
    definicao: def,
    aplicar: (motor) => motor.executar(def),
  };
}

/** Para definições sem carga de apoio. */
export const semApoio = (): Promise<null> => Promise.resolve(null);
