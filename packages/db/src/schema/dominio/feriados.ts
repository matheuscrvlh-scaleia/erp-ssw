/**
 * Agregado Calendário: feriados.
 *
 * `empresa_id` nulo = feriado nacional, que vale para todas as empresas. Preenchido = feriado só
 * daquela empresa (municipal/estadual ou nacional cadastrado à mão por ela).
 *
 * RLS: a empresa lê os nacionais e os dela, e só grava os dela. Nacional só é gravado em sessão
 * de Plataforma (geração automática anual) ou pela migration/seed. Segue o `public.feriados`
 * atual coluna a coluna.
 *
 * Origem: public.feriados.
 */
import { sql } from "drizzle-orm";
import { type AnyPgColumn, boolean, date, index, text, unique, uuid } from "drizzle-orm/pg-core";

import { daEmpresa, ehPlataforma, erp, politicas } from "../base";
import { empresas } from "../plataforma";
import { atualizadoEm, criadoEm } from "./_comum";

function daEmpresaOuNacionalDaPlataforma(coluna: AnyPgColumn) {
  return sql`(${daEmpresa(coluna)} or (${coluna} is null and ${ehPlataforma}))`;
}

export const tipoFeriado = erp.enum("tipo_feriado", ["nacional", "municipal", "estadual"]);

export const feriados = erp.table(
  "feriados",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nulo = feriado nacional (todas as empresas). */
    empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "restrict" }),
    data: date("data", { mode: "string" }).notNull(),
    tipo: tipoFeriado("tipo").notNull(),
    cidade: text("cidade"),
    uf: text("uf"),
    descricao: text("descricao").notNull(),
    geradoAutomaticamente: boolean("gerado_automaticamente").notNull().default(false),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    // Mesmo feriado não se repete no mesmo escopo. NULLS NOT DISTINCT: cidade/uf/empresa nulas
    // contam como iguais (dois nacionais iguais colidem).
    unique("feriados_escopo_uq").on(t.data, t.tipo, t.cidade, t.uf, t.empresaId).nullsNotDistinct(),
    index("feriados_empresa_data_idx").on(t.empresaId, t.data),
    // Nacional (empresa nula) vale para todas e só a Plataforma grava (Q28 do dono).
    ...politicas("feriados", {
      select: sql`(${t.empresaId} is null or ${daEmpresa(t.empresaId)})`,
      insert: daEmpresaOuNacionalDaPlataforma(t.empresaId),
      update: daEmpresaOuNacionalDaPlataforma(t.empresaId),
      delete: daEmpresaOuNacionalDaPlataforma(t.empresaId),
    }),
  ],
);
