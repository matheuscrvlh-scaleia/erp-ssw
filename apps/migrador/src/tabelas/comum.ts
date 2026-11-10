import { type PgTable } from "drizzle-orm/pg-core";

import { type ColunaDe, type Referencia } from "../motor/tipos";

export { daEmpresa, nosUltimosDias } from "../motor/sql";

/** Chave de keyset pelo `id` uuid da origem. */
export const PELO_ID = [{ expressao: "o.id", tipo: "uuid" }] as const;

/** Chave de keyset sobre `empresa_id` anulável (nulo ordena como o uuid zero). */
export function empresaNaChave(coluna: string) {
  return {
    expressao: `coalesce(${coluna}, '00000000-0000-0000-0000-000000000000'::uuid)`,
    tipo: "uuid",
  };
}

/** Escopo do destino de uma tabela de empresa (`--empresa`). */
export const ESCOPO_DA_EMPRESA = "(@empresa is null or empresa_id = @empresa)";

/**
 * A empresa da linha precisa ter migrado (FK `on delete restrict`). Nos ajudantes de
 * referência, o primeiro argumento (a tabela) só fixa o tipo das colunas.
 */
export function referenciaEmpresa<T extends PgTable>(
  _tabela: T,
  coluna: ColunaDe<T>,
): Referencia<T> {
  return {
    colunas: [coluna],
    tabela: "erp.empresas",
    colunasDestino: ["id"],
    tipos: ["uuid"],
    seAusente: { descartar: "empresa não migrou" },
  };
}

/** Usuário (`auth.users.id`) sem par em `erp.usuarios` vira nulo (de-para, regra geral). */
export function referenciaUsuario<T extends PgTable>(
  _tabela: T,
  coluna: ColunaDe<T>,
): Referencia<T> {
  return {
    colunas: [coluna],
    tabela: "erp.usuarios",
    colunasDestino: ["id"],
    tipos: ["uuid"],
    seAusente: { anular: coluna, motivo: `${coluna}: usuário sem par (vira nulo)` },
  };
}

export function referenciaPorId<T extends PgTable>(
  _tabela: T,
  coluna: ColunaDe<T>,
  tabela: string,
  seAusente: Referencia<T>["seAusente"],
): Referencia<T> {
  return { colunas: [coluna], tabela, colunasDestino: ["id"], tipos: ["uuid"], seAusente };
}

/** Coluna `not null` com default no destino e anulável na origem: o default, explícito. */
export function ou<T>(valor: T | null, padrao: T): T {
  return valor ?? padrao;
}
