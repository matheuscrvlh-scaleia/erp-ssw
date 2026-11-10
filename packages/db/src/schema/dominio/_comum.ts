/**
 * Colunas repetidas em todo agregado de domínio.
 *
 * `atualizado_em` é gravado pelo backend no UPDATE (o banco não tem gatilho). O `defaultNow()`
 * só cobre o INSERT.
 */
import { timestamp, uuid } from "drizzle-orm/pg-core";

import { empresas } from "../plataforma";

export { atualizadoEm, criadoEm } from "../base";

/**
 * `empresa_id uuid not null` com FK para `empresas`. `on delete restrict`: empresa não é apagada
 * com dado operacional dentro (ela é encerrada pelo status); apagar em cascata 1,5 mi de
 * ocorrências por engano não pode ser uma possibilidade.
 */
export const empresaId = () =>
  uuid("empresa_id")
    .notNull()
    .references(() => empresas.id, { onDelete: "restrict" });

/** `timestamptz` anulável, no modo `Date`. */
export const instante = (nome: string) => timestamp(nome, { withTimezone: true, mode: "date" });
