import { type ValorJson } from "../transformacoes/json";
import { type MetadadosDaTabela } from "./metadados";
import { type Consulta, type ConsultaDeOrigem, type Executor, type Filtros } from "./tipos";

export interface LoteLido<R> {
  linhas: R[];
  /** Chave (em texto) da última linha do lote; nulo se o lote veio vazio. */
  ultimaChave: string[] | null;
}

/** Leitura do sistema atual (`public`, `auth`, `vault`). Só leitura. */
export interface Origem extends Consulta {
  lerLote<O extends object>(
    consulta: ConsultaDeOrigem,
    filtros: Filtros,
    apos: readonly string[] | null,
    limite: number,
  ): Promise<LoteLido<O>>;
}

export interface PedidoDeGravacao {
  meta: MetadadosDaTabela;
  linhas: readonly Readonly<Record<string, ValorJson>>[];
  conflito: readonly string[];
  aoConflitar: "atualizar" | "ignorar";
  sobreporIdentidade: boolean;
}

export interface TabelaReferenciada {
  tabela: string;
  colunasDestino: readonly string[];
  tipos: readonly string[];
}

export interface PedidoDeLeitura {
  meta: MetadadosDaTabela;
  colunas: readonly string[];
  chave: readonly string[];
  escopo: string;
}

/** Escrita e leitura do schema `erp`. */
export interface Destino extends Consulta, Executor {
  /** Upsert do lote numa transação (tudo ou nada). */
  gravar(pedido: PedidoDeGravacao): Promise<void>;
  /** Quais tuplas existem na tabela referenciada (chave = `chaveDaTupla`). */
  existentes(
    referencia: TabelaReferenciada,
    tuplas: readonly (readonly ValorJson[])[],
  ): Promise<ReadonlySet<string>>;
  lerLote(
    pedido: PedidoDeLeitura,
    filtros: Filtros,
    apos: readonly string[] | null,
    limite: number,
  ): Promise<LoteLido<Record<string, ValorJson>>>;
}

export interface Infra {
  origem: Origem;
  destino: Destino;
}

/** Valor de coluna como o `::text` do Postgres o mostraria (para casar tuplas). */
export function textoDoValor(valor: ValorJson | undefined): string | null {
  if (valor === null || valor === undefined) return null;
  return typeof valor === "object" ? JSON.stringify(valor) : String(valor);
}

export function chaveDaTupla(valores: readonly (ValorJson | undefined)[]): string {
  return JSON.stringify(valores.map(textoDoValor));
}

export interface Log {
  info(dados: object, mensagem: string): void;
  warn(dados: object, mensagem: string): void;
  error(dados: object, mensagem: string): void;
}
