/**
 * Pedaços de SQL das consultas de CT-e (Listagem, filtros). Só expressões sobre colunas gravadas;
 * todo valor de fora entra como parâmetro.
 */
import { ctes } from "@erp/db/schema";
import { FUSO_DO_NEGOCIO } from "@erp/dominio/nucleo";
import { type AnyColumn, type SQL, sql } from "drizzle-orm";

/** Array como UM parâmetro (o `sql` do Drizzle expandiria em lista `($1, $2)`). */
export const textos = (valores: readonly string[]): SQL => sql`${sql.param([...valores])}::text[]`;
export const inteiros = (valores: readonly number[]): SQL => sql`${sql.param([...valores])}::int[]`;
export const uuids = (valores: readonly string[]): SQL => sql`${sql.param([...valores])}::uuid[]`;

/** Dia (Brasília) de um instante. Q11: nada de dia UTC. */
export const diaNoFuso = (instante: AnyColumn | SQL): SQL =>
  sql`(${instante} AT TIME ZONE ${FUSO_DO_NEGOCIO})::date`;

/** Meia-noite (Brasília) de um dia. */
export const inicioDoDia = (dia: AnyColumn | SQL): SQL =>
  sql`(${dia}::timestamp AT TIME ZONE ${FUSO_DO_NEGOCIO})`;

/**
 * Tipo de documento efetivo: o do 455 vence o do BI2; maiúsculas; vazio = sem tipo.
 * origem: tipo_documento_efetivo (sistema atual)
 */
export const tipoDocumentoEfetivo = sql`nullif(upper(coalesce(nullif(btrim(${ctes.tipoDocumento455}), ''), btrim(${ctes.tipoDocumento}))), '')`;

/** CT-e fora de todas as telas (cancelado no dia, cópia) sai sempre. */
export const dentroDoUniverso = (empresaId: string): SQL =>
  sql`${ctes.empresaId} = ${empresaId} and not ${ctes.foraUniverso}`;
