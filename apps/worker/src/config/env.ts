import { z } from "@erp/shared/zod";

const esquema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_NIVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  DATABASE_URL: z.string().min(1),
  DB_MAX_CONEXOES: z.coerce.number().int().positive().default(5),
  // Jobs de ingestão leem mais que uma tela: teto maior que o da API.
  DB_TIMEOUT_CONSULTA_MS: z.coerce.number().int().positive().default(120_000),
  REDIS_URL: z.string().min(1),
  PORTA_SAUDE: z.coerce.number().int().positive().default(3002),
  AGENDAMENTOS_LIGADOS: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /** Liga os agendamentos da ingestão SSW (FTP, ciclo, 455, limpeza); exige AGENDAMENTOS_LIGADOS. */
  INGESTAO_AGENDADA: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /** Cofre das integrações: `"1:<base64 de 32 bytes>,2:<…>"` (formato de `lerChavesDeSegredo`). */
  SEGREDOS_CHAVES: z.string().optional(),
  SEGREDOS_CHAVE_ATUAL: z.coerce.number().int().positive().optional(),
  /** Só para integração com `parametros.usar_env` (transição da FR). */
  SFTP_HOST: z.string().optional(),
  SFTP_PORTA: z.string().optional(),
  SFTP_USUARIO: z.string().optional(),
  SFTP_SENHA: z.string().optional(),
});

export type AmbienteWorker = z.output<typeof esquema>;

export function carregarAmbiente(fonte: Record<string, string | undefined>): AmbienteWorker {
  const resultado = esquema.safeParse(fonte);
  if (!resultado.success) {
    throw new Error(`Configuração inválida:\n${z.prettifyError(resultado.error)}`);
  }
  return resultado.data;
}
