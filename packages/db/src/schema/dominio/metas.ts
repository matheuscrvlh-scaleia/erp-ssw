/**
 * Agregado Metas (Dashboard / Performance): meta de taxa de retorno ou de performance de entrega,
 * por unidade (ou geral, com unidade nula), com vigência.
 *
 * Origem: public.metas.
 */
import { sql } from "drizzle-orm";
import { check, date, index, numeric, uuid } from "drizzle-orm/pg-core";
import { atualizadoEm, criadoEm, empresaId } from "./_comum";
import { esquemaErp, politicasDaEmpresa } from "./_contrato-fundacao";
import { unidades } from "./filiais";

export const tipoMeta = esquemaErp.enum("tipo_meta", ["taxa_retorno", "performance_entrega"]);

export const metas = esquemaErp.table(
  "metas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: empresaId(),
    unidadeId: uuid("unidade_id").references(() => unidades.id, { onDelete: "cascade" }),
    tipoMeta: tipoMeta("tipo_meta").notNull(),
    /** Fração (0,95 = 95%). */
    valor: numeric("valor", { precision: 8, scale: 4 }).notNull(),
    vigenciaInicio: date("vigencia_inicio", { mode: "string" }).notNull(),
    vigenciaFim: date("vigencia_fim", { mode: "string" }),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    check(
      "metas_vigencia_ck",
      sql`${t.vigenciaFim} is null or ${t.vigenciaFim} >= ${t.vigenciaInicio}`,
    ),
    index("metas_empresa_unidade_idx").on(t.empresaId, t.unidadeId),
    ...politicasDaEmpresa("metas"),
  ],
);
