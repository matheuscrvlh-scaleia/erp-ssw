import { z } from "@erp/shared/zod";

const booleano = z.enum(["true", "false", "1", "0"]).transform((v) => v === "true" || v === "1");

/** PEM em variável de ambiente costuma vir com `\n` literal; aceita os dois formatos. */
const pem = z
  .string()
  .min(1)
  .transform((v) => v.replace(/\\n/g, "\n"));

const esquema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("0.0.0.0"),
    PORTA: z.coerce.number().int().positive().default(3001),
    LOG_NIVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    /** Quantos proxies (Caddy) há na frente, para o IP do cliente sair certo. */
    PROXIES_CONFIAVEIS: z.coerce.number().int().min(0).default(0),

    DATABASE_URL: z.string().min(1),
    DB_MAX_CONEXOES: z.coerce.number().int().positive().default(10),
    DB_TIMEOUT_CONSULTA_MS: z.coerce.number().int().positive().default(30_000),
    REDIS_URL: z.string().min(1).optional(),

    WEB_URL: z.url(),
    CORS_ORIGENS: z.string().optional(),

    JWT_CHAVE_PRIVADA: pem,
    JWT_KID: z.string().min(1),
    /** JSON `{ "<kid>": "<PEM público>" }` das chaves anteriores, aceitas até expirarem. */
    JWT_CHAVES_ANTERIORES: z.string().optional(),
    JWT_EMISSOR: z.string().default("erp-ssw"),
    JWT_AUDIENCIA: z.string().default("erp-ssw-web"),
    REFRESH_DIAS: z.coerce.number().int().positive().default(30),
    COOKIE_SEGREDO: z.string().min(32),

    SMTP_HOST: z.string().optional(),
    SMTP_PORTA: z.coerce.number().int().positive().default(587),
    SMTP_SEGURO: booleano.default(false),
    SMTP_USUARIO: z.string().optional(),
    SMTP_SENHA: z.string().optional(),
    EMAIL_REMETENTE: z.string().default("Painel Logístico <nao-responda@localhost>"),

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_REDIRECT_URI: z.url().optional(),

    /** Base pública dos logos (bucket S3); sem ela o menu mostra as iniciais da empresa. */
    LOGO_URL_BASE: z.url().optional(),
    /** Token de leitura de /metrics; sem ele a rota não existe. */
    METRICAS_TOKEN: z.string().min(16).optional(),
    /** Segredo `x-ftp-ingest-secret` das rotas públicas da ingestão; sem ele, 503. */
    FTP_INGEST_SECRET: z.string().min(16).optional(),
  })
  .superRefine((env, ctx) => {
    const google = [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI];
    if (google.some(Boolean) && !google.every(Boolean)) {
      ctx.addIssue({
        code: "custom",
        message: "Google: defina GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI.",
      });
    }
    if (env.NODE_ENV === "production" && !env.REDIS_URL) {
      ctx.addIssue({ code: "custom", message: "Em produção, REDIS_URL é obrigatório." });
    }
    if (env.NODE_ENV === "production" && !env.SMTP_HOST) {
      ctx.addIssue({ code: "custom", message: "Em produção, SMTP_HOST é obrigatório." });
    }
  });

export type Ambiente = z.output<typeof esquema>;

/** Lê e valida o ambiente; erro aqui derruba o boot com a lista do que falta. */
export function carregarAmbiente(fonte: Record<string, string | undefined>): Ambiente {
  const resultado = esquema.safeParse(fonte);
  if (!resultado.success) {
    throw new Error(`Configuração inválida:\n${z.prettifyError(resultado.error)}`);
  }
  return resultado.data;
}

export function origensPermitidas(ambiente: Ambiente): string[] {
  const extras = ambiente.CORS_ORIGENS?.split(",").map((o) => o.trim()) ?? [];
  return [new URL(ambiente.WEB_URL).origin, ...extras.filter(Boolean)];
}
