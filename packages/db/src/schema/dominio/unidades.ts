import { boolean, text, uuid } from "drizzle-orm/pg-core";

import { criadoEm, erp, politicasDeEmpresa } from "../base";
import { empresas } from "../plataforma";

/**
 * Unidades da empresa (o Calendário mostra quais param em cada feriado).
 * Criada pela fundação só porque o Calendário precisa; o agente de domínio é o dono e pode
 * completar as colunas.
 * origem: tabela public.unidades (sistema atual)
 */
export const unidades = erp.table(
  "unidades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    cidade: text("cidade").notNull(),
    uf: text("uf").notNull(),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: criadoEm(),
  },
  (t) => politicasDeEmpresa("unidades", t.empresaId),
);
