/**
 * Agregado BI2 (API CSV do SSW).
 *
 * - `bi2_bruto`: a última linha de cada relatório BI2 por CT-e (upsert, não histórico), guardada
 *   para reprocessar sem chamar o SSW de novo e para o detalhe do CT-e ("lido do BI2 em").
 *   Uma linha por CT-e por relatório: o tamanho acompanha `ctes`, não cresce com o tempo.
 * - `bi2_sincronizacoes`: cada execução de relatório por data-alvo. É o que as telas de BI2 usam
 *   para saber quais dias já foram processados (cursor e janelas de reprocessamento).
 *
 * O BI2 casa só pelo número do CTRC (o relatório não traz a sigla de forma confiável), por isso
 * a chave de `bi2_bruto` é empresa + número + relatório, como hoje.
 *
 * Retenção: `bi2_sincronizacoes` 400 dias (cobre o reprocessamento retroativo do ano); `bi2_bruto`
 * sem retenção por tempo: é upsert, uma linha por CT-e por relatório.
 *
 * Origem: public.bi2_raw, public.bi2_sync_log.
 */
import { date, index, integer, jsonb, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { atualizadoEm, empresaId, instante } from "./_comum";
import { esquemaErp, politicasDaEmpresa } from "./_contrato-fundacao";

export const bi2Bruto = esquemaErp.table(
  "bi2_bruto",
  {
    empresaId: empresaId(),
    /** Número do CTRC (dígitos). */
    numero: text("numero").notNull(),
    /** Código do relatório como o ingestor grava hoje (ex.: "174", "220"). */
    codigoRelatorio: text("codigo_relatorio").notNull(),
    dataAlvo: date("data_alvo", { mode: "string" }).notNull(),
    payload: jsonb("payload").notNull(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    primaryKey({ name: "bi2_bruto_pk", columns: [t.empresaId, t.numero, t.codigoRelatorio] }),
    index("bi2_bruto_relatorio_data_idx").on(t.empresaId, t.codigoRelatorio, t.dataAlvo),
    ...politicasDaEmpresa("bi2_bruto"),
  ],
);

export const bi2Sincronizacoes = esquemaErp.table(
  "bi2_sincronizacoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: empresaId(),
    codigoRelatorio: text("codigo_relatorio").notNull(),
    /** Data de emissão-alvo do ciclo. */
    dataAlvo: date("data_alvo", { mode: "string" }).notNull(),
    /** Data enviada ao SSW como `data=` (fechamento); as emissões devolvidas são do dia útil anterior. */
    dataFechamentoSsw: date("data_fechamento_ssw", { mode: "string" }),
    modo: text("modo").notNull().default("manual"),
    status: text("status").notNull().default("ok"),
    totalLinhas: integer("total_linhas").notNull().default(0),
    criados: integer("criados").notNull().default(0),
    atualizados: integer("atualizados").notNull().default(0),
    erro: text("erro"),
    iniciadoEm: instante("iniciado_em").notNull().defaultNow(),
    finalizadoEm: instante("finalizado_em"),
  },
  (t) => [
    index("bi2_sincronizacoes_relatorio_iniciado_idx").on(
      t.empresaId,
      t.codigoRelatorio,
      t.iniciadoEm.desc(),
    ),
    index("bi2_sincronizacoes_relatorio_data_idx").on(t.empresaId, t.codigoRelatorio, t.dataAlvo),
    ...politicasDaEmpresa("bi2_sincronizacoes"),
  ],
);
