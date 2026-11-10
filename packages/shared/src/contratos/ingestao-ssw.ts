import { contrato } from "../contrato";
import { ehDataIso } from "../datas";
import { z } from "../zod";

/**
 * Ingestão SSW: faixa "Integração SSW indisponível" (todo usuário com empresa), Admin › Ingestão
 * SSW e Plataforma › Diagnóstico SSW (só a Plataforma, na empresa ativa).
 */

const instante = z.iso.datetime();
const dataIso = z.string().refine(ehDataIso, "Data inválida (use AAAA-MM-DD).");

export const MOTIVOS_DA_SAUDE = ["ok", "sem_credenciais", "sem_token", "token_expirado"] as const;

export const saudeSsw = z.object({
  configurado: z.boolean(),
  tokenValido: z.boolean(),
  tokenAtualizadoEm: instante.nullable(),
  saudavel: z.boolean(),
  motivo: z.enum(MOTIVOS_DA_SAUDE),
});

/** Selo "Dados atualizados em…": última aplicação do ciclo de arquivos e XML aguardando. */
export const atualizacaoDosDados = z.object({
  atualizadoEm: instante.nullable(),
  /** Só para a Plataforma (a fila de XML é dela); nulo para os demais. */
  xmlAguardando: z.object({ pendentes: z.number().int(), expirados: z.number().int() }).nullable(),
});

export const sincronizacaoBi2 = z.object({
  relatorio: z.string(),
  dataAlvo: z.string(),
  dataFechamentoSsw: z.string().nullable(),
  modo: z.string(),
  status: z.string(),
  totalLinhas: z.number().int(),
  criados: z.number().int(),
  atualizados: z.number().int(),
  erro: z.string().nullable(),
  iniciadoEm: instante,
  finalizadoEm: instante.nullable(),
});

export type SincronizacaoBi2 = z.infer<typeof sincronizacaoBi2>;

export const credenciaisSsw = z.object({
  /** Integração `ssw_api` ligada na empresa. */
  ativo: z.boolean(),
  dominio: z.string(),
  usuario: z.string(),
  cnpjEdi: z.string(),
  temSenha: z.boolean(),
  tokenStatus: z.enum(["valido", "expirado", "ausente"]),
  tokenAtualizadoEm: instante.nullable(),
  tokenExpiraEm: instante.nullable(),
  ttlHoras: z.number(),
  atualizadoEm: instante.nullable(),
  ultimaVerificacao: z
    .object({
      em: instante,
      ok: z.boolean(),
      mensagem: z.string().nullable(),
    })
    .nullable(),
});

export const TIPOS_DE_FALHA_SSW = [
  "upstream_unavailable",
  "permission_denied",
  "auth_failed",
] as const;

export const resultadoDoTesteSsw = z.object({
  ok: z.boolean(),
  /** O job não terminou a tempo; o resultado aparece na próxima verificação. */
  pendente: z.boolean(),
  renovado: z.boolean(),
  mensagem: z.string(),
  tipoFalha: z.enum(TIPOS_DE_FALHA_SSW).nullable(),
  tokenPrevia: z.string().nullable(),
});

export type ResultadoDoTesteSsw = z.infer<typeof resultadoDoTesteSsw>;

export const eventoWebhook = z.object({
  id: z.uuid(),
  recebidoEm: instante,
  statusHttp: z.number().int(),
  autenticado: z.boolean(),
  motivoRejeicao: z.string().nullable(),
  erroProcessamento: z.string().nullable(),
  cteId: z.uuid().nullable(),
  /** Número do CT-e casado (para o link do detalhe). */
  numeroCte: z.string().nullable(),
  temPayload: z.boolean(),
});

export type EventoWebhook = z.infer<typeof eventoWebhook>;

const contagemWebhook = z.object({
  total: z.number().int(),
  processados: z.number().int(),
  semVinculo: z.number().int(),
  rejeitados: z.number().int(),
  erros: z.number().int(),
});

export type ContagemWebhook = z.infer<typeof contagemWebhook>;

export const statusDoJob = z.object({
  job: z.string(),
  descricao: z.string(),
  integracao: z.string(),
  /** Cron (UTC) do catálogo; `null` = sob demanda. */
  cron: z.string().nullable(),
  /** Integração ligada na empresa ativa. */
  integracaoLigada: z.boolean(),
  /** O agendador do worker tem o agendamento no Redis. */
  agendado: z.boolean(),
  proximaExecucao: instante.nullable(),
  aguardando: z.number().int(),
  ativos: z.number().int(),
  atrasados: z.number().int(),
  falhos: z.number().int(),
  ultimaConclusao: instante.nullable(),
  ultimasFalhas: z.array(
    z.object({
      id: z.string(),
      quando: instante.nullable(),
      erro: z.string(),
      tentativas: z.number().int(),
    }),
  ),
});

export type StatusDoJob = z.infer<typeof statusDoJob>;

export const diagnosticoSsw = z.object({
  /** `false` = API sem Redis: o status dos jobs não está disponível. */
  filasDisponiveis: z.boolean(),
  jobs: z.array(statusDoJob),
  sincronizacoes: z.array(sincronizacaoBi2),
  webhook: z.object({
    ultimaAtividade: instante.nullable(),
    ultimas24h: contagemWebhook,
    ultimos7d: contagemWebhook,
  }),
  orfaos: z.object({
    /** Eventos autenticados sem CT-e (número que não casou), últimos 7 dias. */
    webhookSemVinculo7d: z.number().int(),
    recentes: z.array(
      z.object({ id: z.uuid(), recebidoEm: instante, numero: z.string().nullable() }),
    ),
    /** XML de CT-e na fila de órfãos (pendentes). */
    xmlPendentes: z.number().int(),
  }),
});

export const contratosIngestaoSsw = {
  atualizacao: contrato({
    metodo: "GET",
    caminho: "/api/v1/ssw/atualizacao",
    saida: atualizacaoDosDados,
  }),
  saude: contrato({
    metodo: "GET",
    caminho: "/api/v1/ssw/saude",
    saida: saudeSsw,
  }),
  bi2Status: contrato({
    metodo: "GET",
    caminho: "/api/v1/admin/ingestao/bi2-0017",
    saida: z.object({
      ultima: sincronizacaoBi2.nullable(),
      recentes: z.array(sincronizacaoBi2),
    }),
  }),
  rodarBi2: contrato({
    metodo: "POST",
    caminho: "/api/v1/admin/ingestao/bi2-0017/rodar",
    entrada: z.object({ data: dataIso }),
    saida: z.object({
      enfileirado: z.boolean(),
      pendente: z.boolean(),
      resultado: sincronizacaoBi2.nullable(),
    }),
  }),
  credenciais: contrato({
    metodo: "GET",
    caminho: "/api/v1/admin/ingestao/ssw-api",
    saida: credenciaisSsw,
  }),
  salvarCredenciais: contrato({
    metodo: "PUT",
    caminho: "/api/v1/admin/ingestao/ssw-api",
    entrada: z.object({
      dominio: z.string().trim().max(64).optional(),
      usuario: z.string().trim().max(64).optional(),
      senha: z
        .string()
        .max(256)
        .refine((s) => s === "" || s.trim() !== "", "A senha não pode ser só espaços.")
        .optional(),
      cnpjEdi: z
        .string()
        .trim()
        .refine(
          (s) => s === "" || s.replace(/\D/g, "").length === 14,
          "CNPJ precisa ter 14 dígitos.",
        )
        .optional(),
    }),
    saida: z.object({ tokenInvalidado: z.boolean() }),
  }),
  testarConexao: contrato({
    metodo: "POST",
    caminho: "/api/v1/admin/ingestao/ssw-api/testar",
    saida: resultadoDoTesteSsw,
  }),
  eventosWebhook: contrato({
    metodo: "GET",
    caminho: "/api/v1/admin/ingestao/webhook/eventos",
    saida: z.object({ ultimaAtividade: instante.nullable(), eventos: z.array(eventoWebhook) }),
  }),
  reprocessarEvento: contrato({
    metodo: "POST",
    caminho: "/api/v1/admin/ingestao/webhook/eventos/:id/reprocessar",
    parametros: z.object({ id: z.uuid() }),
    saida: z.object({ enfileirado: z.boolean() }),
  }),
  diagnostico: contrato({
    metodo: "GET",
    caminho: "/api/v1/admin/ssw-diagnostico",
    saida: diagnosticoSsw,
  }),
  reprocessarTokenIncorreto: contrato({
    metodo: "POST",
    caminho: "/api/v1/admin/ssw-diagnostico/webhook/reprocessar-token-incorreto",
    saida: z.object({ total: z.number().int(), enfileirados: z.number().int() }),
  }),
} as const;
