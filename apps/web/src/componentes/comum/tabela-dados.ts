import { type ReactNode } from "react";

import { type FormatoColuna } from "@/lib/exportacao";

export type Direcao = "asc" | "desc";

export interface Ordenacao {
  chave: string;
  direcao: Direcao;
}

export interface ColunaTabela<T> {
  /** Identifica a coluna; sem `valor`, também é a propriedade lida da linha. */
  chave: string;
  titulo: string;
  /** Valor bruto: ordena, exporta e preenche a célula padrão. */
  valor?: ((linha: T) => unknown) | undefined;
  /** Célula própria (selo, link). Sem ela, o valor sai formatado por `formato`. */
  celula?: ((linha: T) => ReactNode) | undefined;
  formato?: FormatoColuna | undefined;
  /** Padrão: true. */
  ordenavel?: boolean | undefined;
  /** Padrão: à direita para número/moeda/percentual, à esquerda no resto. */
  alinhamento?: "esquerda" | "direita" | "centro" | undefined;
  /** Classes extras da célula (ex.: "font-mono", "max-w-[200px] truncate"). */
  classe?: string | undefined;
  /** Começa escondida; o usuário liga em "Colunas". */
  oculta?: boolean | undefined;
  /** Não pode ser escondida em "Colunas". */
  fixa?: boolean | undefined;
  /** Fica fora da exportação (ex.: coluna de ações). */
  semExportar?: boolean | undefined;
}

export function valorDaColuna<T extends object>(coluna: ColunaTabela<T>, linha: T): unknown {
  if (coluna.valor) return coluna.valor(linha);
  const valor: unknown = Reflect.get(linha, coluna.chave);
  return valor;
}

const NUMERICOS: ReadonlySet<FormatoColuna> = new Set([
  "inteiro",
  "decimal",
  "percentual",
  "moeda",
]);

export function alinhamentoDa<T>(coluna: ColunaTabela<T>): "esquerda" | "direita" | "centro" {
  return (
    coluna.alinhamento ?? (coluna.formato && NUMERICOS.has(coluna.formato) ? "direita" : "esquerda")
  );
}

const colador = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

/** Vazio sempre por último, nas duas direções; número como número, texto em ordem pt-BR. */
export function compararValores(a: unknown, b: unknown, direcao: Direcao): number {
  const aVazio = a == null || a === "";
  const bVazio = b == null || b === "";
  if (aVazio || bVazio) return aVazio === bVazio ? 0 : aVazio ? 1 : -1;
  const sinal = direcao === "asc" ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return (a - b) * sinal;
  if (typeof a === "boolean" && typeof b === "boolean") return (Number(a) - Number(b)) * sinal;
  return colador.compare(texto(a), texto(b)) * sinal;
}

function texto(valor: unknown): string {
  return typeof valor === "string" || typeof valor === "number" ? String(valor) : "";
}

/** Ordenação estável (empate mantém a ordem que veio do servidor). */
export function ordenarLinhas<T extends object>(
  linhas: readonly T[],
  coluna: ColunaTabela<T> | undefined,
  direcao: Direcao,
): readonly T[] {
  if (!coluna) return linhas;
  return linhas
    .map((linha, indice) => ({ linha, indice, valor: valorDaColuna(coluna, linha) }))
    .sort((x, y) => compararValores(x.valor, y.valor, direcao) || x.indice - y.indice)
    .map((x) => x.linha);
}

export function totalDePaginas(total: number, porPagina: number): number {
  return porPagina > 0 ? Math.max(1, Math.ceil(total / porPagina)) : 1;
}

/** Fatia da página (1-based), sempre dentro do intervalo válido. */
export function fatiarPagina<T>(linhas: readonly T[], pagina: number, porPagina: number) {
  if (porPagina <= 0) return { linhas, pagina: 1 };
  const valida = Math.min(Math.max(1, pagina), totalDePaginas(linhas.length, porPagina));
  return { linhas: linhas.slice((valida - 1) * porPagina, valida * porPagina), pagina: valida };
}

/** Clique no cabeçalho: mesma coluna inverte; coluna nova começa crescente. */
export function proximaOrdenacao(atual: Ordenacao | null, chave: string): Ordenacao {
  return atual?.chave === chave
    ? { chave, direcao: atual.direcao === "asc" ? "desc" : "asc" }
    : { chave, direcao: "asc" };
}
