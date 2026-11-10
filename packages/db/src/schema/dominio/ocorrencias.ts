/**
 * Agregado Ocorrências do CT-e.
 *
 * Um evento SSW (código 0–99) num instante. Chegam pelo 930 (FTP), pelo webhook SSW e pelas
 * aplicações de relatório. ~1,5 mi de linhas: é a maior tabela de domínio junto com `ctes`.
 *
 * Gravar/apagar uma ocorrência recalcula, na mesma transação, as colunas derivadas do CT-e
 * (ocorrência efetiva, cancelado no mesmo dia, embarque, emissão pela 80, status atual): antes
 * eram 6 gatilhos em `ocorrencias`.
 *
 * Origem: public.ocorrencias.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { criadoEm, empresaId } from "./_comum";
import { esquemaErp, politicasDaEmpresa } from "./_contrato-fundacao";
import { codigosOcorrencia, responsavelOcorrencia } from "./codigos-ocorrencia";
import { ctes } from "./ctes";

export const ocorrencias = esquemaErp.table(
  "ocorrencias",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: empresaId(),
    cteId: uuid("cte_id")
      .notNull()
      .references(() => ctes.id, { onDelete: "cascade" }),
    codigo: smallint("codigo").notNull(),
    descricao: text("descricao"),
    complemento: text("complemento"),
    dataHora: timestamp("data_hora", { withTimezone: true, mode: "date" }).notNull(),
    /** Filial onde a ocorrência foi lançada (sigla SSW). */
    filial: text("filial"),
    /** Protocolo do evento no webhook SSW: deduplica reentrega do mesmo evento. */
    protocoloSsw: text("protocolo_ssw"),
    /**
     * Canal de entrada (ex.: manual, webhook, relatorio_ssw, aplicacao_ssw, trackingdanfe).
     * Texto livre de propósito: o migrador preserva os valores atuais; a spec da ingestão fecha
     * a lista e aí vira check.
     */
    origem: text("origem").notNull().default("manual"),
    // calculada pelo backend: do catálogo (codigos_ocorrencia.responsavel) ao gravar; regravada em todas as ocorrências do código quando o catálogo muda. origem: fill_ocorrencia_penaliza / propagate_codigo_changes
    responsavel: responsavelOcorrencia("responsavel").notNull(),
    // calculada pelo backend: do catálogo (codigos_ocorrencia.penaliza), mesma regra de responsavel. origem: fill_ocorrencia_penaliza / propagate_codigo_changes
    penaliza: boolean("penaliza").notNull().default(false),
    // calculada pelo backend: dia (SP) de data_hora anterior à emissão do CT-e (ou trackingdanfe 400 dias antes da criação do CT-e) → não entra nas regras. origem: guard_data_ocorrencia
    quarentena: boolean("quarentena").notNull().default(false),
    criadoEm: criadoEm(),
  },
  (t) => [
    foreignKey({
      name: "ocorrencias_codigo_fk",
      columns: [t.empresaId, t.codigo],
      foreignColumns: [codigosOcorrencia.empresaId, codigosOcorrencia.codigo],
    }).onDelete("restrict"),
    // Mesmo evento não entra duas vezes; também serve a "ocorrências do CT-e" e "CT-e tem código X".
    unique("ocorrencias_cte_codigo_data_uq").on(t.cteId, t.codigo, t.dataHora),
    uniqueIndex("ocorrencias_protocolo_ssw_uq")
      .on(t.empresaId, t.protocoloSsw)
      .where(sql`${t.protocoloSsw} is not null`),
    // Painel de Ocorrências: período pela data da ocorrência. Sem filtro de código é o índice de
    // cobertura `ocorrencias_data_cobre_idx` (docs/dados/ddl-complementar.sql); com filtro:
    index("ocorrencias_codigo_data_idx").on(t.empresaId, t.codigo, t.dataHora),
    // Agregações de penalizantes por CT-e (Performance, Ranking).
    index("ocorrencias_penaliza_cte_idx")
      .on(t.cteId)
      .where(sql`${t.penaliza}`),
    index("ocorrencias_quarentena_cte_idx")
      .on(t.cteId)
      .where(sql`${t.quarentena}`),
    // Código 84 por filial (devolução/retorno por unidade).
    index("ocorrencias_84_filial_idx")
      .on(t.empresaId, t.filial, t.dataHora)
      .where(sql`${t.codigo} = 84`),
    ...politicasDaEmpresa("ocorrencias"),
  ],
);
