import { getTableColumns, is } from "drizzle-orm";
import { getTableConfig, PgEnumColumn, type PgTable } from "drizzle-orm/pg-core";

export interface ColunaSql {
  /** Nome da coluna no banco. */
  nome: string;
  /** Tipo para o cast do parâmetro (enum já qualificado com o schema). */
  tipo: string;
  json: boolean;
  identidade: boolean;
}

export interface MetadadosDaTabela {
  /** `"erp"."ctes"` */
  nomeSql: string;
  colunas: ReadonlyMap<string, ColunaSql>;
}

const aspas = (nome: string) => `"${nome.replaceAll('"', '""')}"`;

/** Nome, tipo e natureza de cada coluna a partir do schema Drizzle (fonte da verdade do `erp`). */
export function metadadosDe(tabela: PgTable): MetadadosDaTabela {
  const config = getTableConfig(tabela);
  const schema = config.schema ?? "public";
  const colunas = new Map<string, ColunaSql>();
  for (const [propriedade, coluna] of Object.entries(getTableColumns(tabela))) {
    const tipoBase = coluna.getSQLType();
    colunas.set(propriedade, {
      nome: coluna.name,
      tipo: is(coluna, PgEnumColumn) ? `${aspas(schema)}.${aspas(tipoBase)}` : tipoBase,
      json: tipoBase === "jsonb" || tipoBase === "json",
      identidade: coluna.generatedIdentity !== undefined,
    });
  }
  return { nomeSql: `${aspas(schema)}.${aspas(config.name)}`, colunas };
}

export function colunaSql(meta: MetadadosDaTabela, propriedade: string): ColunaSql {
  const coluna = meta.colunas.get(propriedade);
  if (!coluna) throw new Error(`Coluna ${propriedade} não existe em ${meta.nomeSql}.`);
  return coluna;
}

export function identificador(nome: string): string {
  return aspas(nome);
}
