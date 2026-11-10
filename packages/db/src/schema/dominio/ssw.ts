/**
 * Agregado Integração SSW (webhook e WebAPI).
 *
 * - `ssw_webhook_eventos`: cada chamada recebida em `/api/public/ssw-ocorrencias` de uma empresa
 *   identificada (autenticada ou rejeitada por regra). O payload fica para o reprocessamento
 *   manual da tela SSW Diagnóstico. Chamada sem empresa identificável (segredo inválido) não
 *   entra aqui: vai só para o log estruturado da API.
 * - `ssw_sincronizacoes`: log das execuções contra a WebAPI do SSW; a tela Ingestão lê a última
 *   falha de autenticação daqui.
 *
 * Credenciais e configuração do SSW (token, usuário, senha, segredo do webhook, CNPJs aceitos,
 * última verificação) NÃO são domínio: vão para `empresa_integracoes` da fundação.
 *
 * Retenção (job do worker): webhook 90 dias por `recebido_em`; sincronizações 90 dias por
 * `executado_em`.
 *
 * Origem: public.ssw_webhook_eventos, public.sync_log.
 */
import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, smallint, text, uuid } from "drizzle-orm/pg-core";

import { erp, politicasDeEmpresa } from "../base";
import { empresaId, instante } from "./_comum";
import { ctes } from "./ctes";
import { ocorrencias } from "./ocorrencias";

export const sswWebhookEventos = erp.table(
  "ssw_webhook_eventos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: empresaId(),
    recebidoEm: instante("recebido_em").notNull().defaultNow(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    autenticado: boolean("autenticado").notNull().default(false),
    motivoRejeicao: text("motivo_rejeicao"),
    statusHttp: smallint("status_http").notNull(),
    payloadBruto: jsonb("payload_bruto"),
    cteId: uuid("cte_id").references(() => ctes.id, { onDelete: "set null" }),
    ocorrenciaId: uuid("ocorrencia_id").references(() => ocorrencias.id, { onDelete: "set null" }),
    erroProcessamento: text("erro_processamento"),
  },
  (t) => [
    // Últimos eventos e contagens por período (cards da tela).
    index("ssw_webhook_eventos_recebido_idx").on(t.empresaId, t.recebidoEm.desc()),
    index("ssw_webhook_eventos_status_idx").on(t.empresaId, t.statusHttp, t.recebidoEm.desc()),
    ...politicasDeEmpresa("ssw_webhook_eventos", t.empresaId),
  ],
);

export const sswSincronizacoes = erp.table(
  "ssw_sincronizacoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: empresaId(),
    modo: text("modo", { enum: ["historico", "delta"] }).notNull(),
    status: text("status", { enum: ["ok", "erro", "parcial", "em_andamento"] }).notNull(),
    disparadoPor: text("disparado_por", { enum: ["agendamento", "manual", "api"] })
      .notNull()
      .default("agendamento"),
    executadoEm: instante("executado_em").notNull().defaultNow(),
    finalizadoEm: instante("finalizado_em"),
    ctesProcessados: integer("ctes_processados").notNull().default(0),
    ocorrenciasProcessadas: integer("ocorrencias_processadas").notNull().default(0),
    duracaoMs: integer("duracao_ms").notNull().default(0),
    mensagem: text("mensagem"),
    /** Mensagens de erro da execução (lista de texto). */
    erros: jsonb("erros")
      .notNull()
      .default(sql`'[]'::jsonb`),
  },
  (t) => [
    check("ssw_sincronizacoes_modo_ck", sql`${t.modo} in ('historico', 'delta')`),
    check(
      "ssw_sincronizacoes_status_ck",
      sql`${t.status} in ('ok', 'erro', 'parcial', 'em_andamento')`,
    ),
    check(
      "ssw_sincronizacoes_disparado_ck",
      sql`${t.disparadoPor} in ('agendamento', 'manual', 'api')`,
    ),
    index("ssw_sincronizacoes_executado_idx").on(t.empresaId, t.executadoEm.desc()),
    ...politicasDeEmpresa("ssw_sincronizacoes", t.empresaId),
  ],
);
