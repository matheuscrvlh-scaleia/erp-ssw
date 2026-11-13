/**
 * Ponte entre a linha do banco (`snake_case`) e o objeto do TypeScript (`camelCase`) nas tabelas
 * largas que o código lê e grava inteiras (CT-e, coleta). O nome da coluna sai do nome do campo:
 * `tipoDocumento455` ↔ `tipo_documento_455`, `ocorr036Codigo` ↔ `ocorr_036_codigo`.
 */
import { type Linha } from "./client";
import { type Sql, sql } from "./sql";

const colunaDoCampo = (campo: string): string =>
  campo.replace(/(?<=[a-z])(?=[A-Z0-9])|(?<=[0-9])(?=[A-Za-z])/g, "_").toLowerCase();

const campoDaColuna = (coluna: string): string =>
  coluna.replace(/_([a-z0-9])/g, (_, letra: string) => letra.toUpperCase());

/** Chaves da linha em `camelCase`; os valores ficam como o `pg` entregou. */
export function camposDaLinha(linha: Linha): Record<string, unknown> {
  return Object.fromEntries(Object.entries(linha).map(([c, v]) => [campoDaColuna(c), v]));
}

const definidos = (objeto: object): [string, unknown][] =>
  Object.entries(objeto).filter(([, v]) => v !== undefined);

/**
 * `(col_a, col_b) values ($1, $2), ($3, $4)`. Colunas = união dos campos definidos; campo ausente
 * numa linha vira `default`. Valor de coluna jsonb vai já em texto (`JSON.stringify`).
 */
export function valoresDeInsercao(linhas: readonly object[]): Sql {
  const campos = [...new Set(linhas.flatMap((l) => definidos(l).map(([c]) => c)))];
  const colunas = sql.juntar(campos.map((c) => sql.identificador(colunaDoCampo(c))));
  const tuplas = linhas.map((linha) => {
    const valores = new Map(definidos(linha));
    return sql`(${sql.juntar(campos.map((c) => (valores.has(c) ? sql`${valores.get(c)}` : sql`default`)))})`;
  });
  return sql`(${colunas}) values ${sql.juntar(tuplas)}`;
}

/** `col_a = $1, col_b = $2` dos campos definidos (para `update ... set`). */
export function atribuicoes(campos: object): Sql {
  return sql.juntar(
    definidos(campos).map(([c, v]) => sql`${sql.identificador(colunaDoCampo(c))} = ${v}`),
  );
}
