/**
 * Agregado Parceiros e Prazos configurados.
 *
 * - `parceiros`: transportadoras parceiras com prazo acordado (tela Prazo de parceiro).
 * - `prazos_configurados`: regra de prazo por unidade (horas), por parceiro (dias) ou por
 *   transbordo unidade→unidade (dias). Usada para calcular a previsão do CT-e.
 *
 * Não existe tabela de pagadores: pagador é atributo do CT-e (`ctes.pagador_cnpj/nome`) e a
 * lista de pagadores da tela é consulta sobre `ctes`.
 *
 * Origem: public.parceiros, public.prazos_configurados.
 */
import { sql } from "drizzle-orm";
import { boolean, check, integer, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { erp, politicasDeEmpresa } from "../base";
import { atualizadoEm, criadoEm, empresaId } from "./_comum";

export const parceiros = erp.table(
  "parceiros",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: empresaId(),
    nome: text("nome").notNull(),
    cnpj: text("cnpj"),
    usaSsw: boolean("usa_ssw").notNull().default(false),
    prazoAcordoHoras: integer("prazo_acordo_horas").notNull().default(48),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: criadoEm(),
  },
  (t) => [
    uniqueIndex("parceiros_empresa_cnpj_uq").on(t.empresaId, t.cnpj),
    ...politicasDeEmpresa("parceiros", t.empresaId),
  ],
);

export const prazosConfigurados = erp.table(
  "prazos_configurados",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: empresaId(),
    tipo: text("tipo", { enum: ["unidade", "parceiro", "transbordo"] }).notNull(),
    unidadeCodigo: text("unidade_codigo"),
    unidadeDestinoCodigo: text("unidade_destino_codigo"),
    parceiroCnpj: text("parceiro_cnpj"),
    parceiroNome: text("parceiro_nome"),
    prazoHoras: integer("prazo_horas"),
    prazoDias: integer("prazo_dias"),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    check("prazos_configurados_tipo_ck", sql`${t.tipo} in ('unidade', 'parceiro', 'transbordo')`),
    check(
      "prazos_configurados_campos_ck",
      sql`(${t.tipo} = 'unidade' and ${t.unidadeCodigo} is not null and ${t.prazoHoras} is not null)
        or (${t.tipo} = 'parceiro' and ${t.parceiroCnpj} is not null and ${t.prazoDias} is not null)
        or (${t.tipo} = 'transbordo' and ${t.unidadeCodigo} is not null
            and ${t.unidadeDestinoCodigo} is not null and ${t.prazoDias} is not null)`,
    ),
    uniqueIndex("prazos_configurados_unidade_uq")
      .on(t.empresaId, t.unidadeCodigo)
      .where(sql`${t.tipo} = 'unidade'`),
    uniqueIndex("prazos_configurados_parceiro_uq")
      .on(t.empresaId, t.parceiroCnpj)
      .where(sql`${t.tipo} = 'parceiro'`),
    uniqueIndex("prazos_configurados_transbordo_uq")
      .on(t.empresaId, t.unidadeCodigo, t.unidadeDestinoCodigo)
      .where(sql`${t.tipo} = 'transbordo'`),
    ...politicasDeEmpresa("prazos_configurados", t.empresaId),
  ],
);
