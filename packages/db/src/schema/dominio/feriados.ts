/**
 * Agregado Calendário: feriados.
 *
 * `empresa_id` nulo = feriado nacional, que vale para todas as empresas. Preenchido = feriado só
 * daquela empresa (municipal/estadual ou nacional cadastrado à mão por ela).
 *
 * RLS: a empresa lê os nacionais e os dela, e só grava os dela. Nacional só é gravado em sessão
 * de Plataforma (geração automática anual) ou pela migration/seed.
 *
 * Nota de coordenação: a fundação pode criar este mesmo arquivo para o Calendário. Se criou,
 * fica uma definição só (esta segue o `public.feriados` atual coluna a coluna).
 *
 * Origem: public.feriados.
 */
import { sql } from "drizzle-orm";
import { boolean, date, index, pgPolicy, text, unique, uuid } from "drizzle-orm/pg-core";
import { atualizadoEm, criadoEm } from "./_comum";
import { empresaDaSessao, empresas, esquemaErp, sessaoDePlataforma } from "./_contrato-fundacao";

export const tipoFeriado = esquemaErp.enum("tipo_feriado", ["nacional", "municipal", "estadual"]);

export const feriados = esquemaErp.table(
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
    pgPolicy("feriados_select", {
      for: "select",
      using: sql`${t.empresaId} is null or ${t.empresaId} = ${empresaDaSessao}`,
    }),
    pgPolicy("feriados_insert", {
      for: "insert",
      withCheck: sql`${t.empresaId} = ${empresaDaSessao}
        or (${t.empresaId} is null and ${sessaoDePlataforma})`,
    }),
    pgPolicy("feriados_update", {
      for: "update",
      using: sql`${t.empresaId} = ${empresaDaSessao}
        or (${t.empresaId} is null and ${sessaoDePlataforma})`,
      withCheck: sql`${t.empresaId} = ${empresaDaSessao}
        or (${t.empresaId} is null and ${sessaoDePlataforma})`,
    }),
    pgPolicy("feriados_delete", {
      for: "delete",
      using: sql`${t.empresaId} = ${empresaDaSessao}
        or (${t.empresaId} is null and ${sessaoDePlataforma})`,
    }),
  ],
);
