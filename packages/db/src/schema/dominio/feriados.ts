import { TIPOS_FERIADO } from "@erp/shared/contratos/calendario";
import { sql } from "drizzle-orm";
import { boolean, check, date, index, text, unique, uuid } from "drizzle-orm/pg-core";

import { criadoEm, daEmpresa, daEmpresaOuPlataforma, erp, politicas } from "../base";
import { empresas } from "../plataforma";

/**
 * Feriados. `empresa_id` nulo = nacional gerado para todas as empresas; só a Plataforma altera
 * ou apaga esses. A empresa pode gerar os nacionais (insert com empresa nula, tipo nacional e
 * marcado como automático), igual à função `gerar_feriados_nacionais` de hoje.
 * origem: tabela public.feriados (sistema atual)
 */
export const feriados = erp.table(
  "feriados",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "cascade" }),
    data: date("data", { mode: "string" }).notNull(),
    tipo: text("tipo", { enum: TIPOS_FERIADO }).notNull(),
    cidade: text("cidade"),
    uf: text("uf"),
    descricao: text("descricao").notNull(),
    geradoAutomaticamente: boolean("gerado_automaticamente").notNull().default(false),
    criadoEm: criadoEm(),
  },
  (t) => [
    // NULLS NOT DISTINCT: nulo em cidade/uf/empresa conta como valor igual (sem COALESCE).
    unique("feriados_unico").on(t.data, t.tipo, t.cidade, t.uf, t.empresaId).nullsNotDistinct(),
    index("feriados_data_idx").on(t.data),
    check("feriados_uf_formato", sql`${t.uf} is null or ${t.uf} ~ '^[A-Z]{2}$'`),
    ...politicas("feriados", {
      select: sql`(${t.empresaId} is null or ${daEmpresa(t.empresaId)})`,
      insert: sql`(${daEmpresaOuPlataforma(t.empresaId)} or (${t.empresaId} is null
        and ${t.tipo} = 'nacional' and ${t.geradoAutomaticamente}))`,
      update: daEmpresaOuPlataforma(t.empresaId),
      delete: daEmpresaOuPlataforma(t.empresaId),
    }),
  ],
);
