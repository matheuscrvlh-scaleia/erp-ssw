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
  /**
   * Jobs de ingestão que o agendador dispara (separados por vírgula, ex.: `bi2-0017,verificar-token-ssw`).
   * Vazio = nenhum: cada job é ligado de propósito, no ambiente que deve rodar.
   */
  INGESTAO_JOBS_LIGADOS: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((j) => j.trim())
        .filter(Boolean),
    ),
  /** Chaves mestras dos segredos de integração (`1:<base64 32 bytes>,2:...`) e a versão atual. */
  SEGREDOS_CHAVES: z.string().min(1).optional(),
  SEGREDOS_CHAVE_ATUAL: z.coerce.number().int().positive().default(1),
  /** SFTP da ingestão: só vale para integração com `parametros.usar_env` (transição da FR). */
  SFTP_HOST: z.string().optional(),
  SFTP_PORTA: z.string().optional(),
  SFTP_USUARIO: z.string().optional(),
  SFTP_SENHA: z.string().optional(),
  /** Impressão SHA-256 da chave do servidor (`SHA256:…`); sem ela o SFTP não conecta. */
  SFTP_IMPRESSAO_DIGITAL: z.string().optional(),
});

export type AmbienteWorker = z.output<typeof esquema>;

export function carregarAmbiente(fonte: Record<string, string | undefined>): AmbienteWorker {
  const resultado = esquema.safeParse(fonte);
  if (!resultado.success) {
    throw new Error(`Configuração inválida:\n${z.prettifyError(resultado.error)}`);
  }
  return resultado.data;
}
