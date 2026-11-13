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

    /**
     * Origem do web fora da mesma origem (desenvolvimento: o Vite). Em produção o domínio vem de
     * Plataforma › Integrações; aqui só serve de reserva e para o CORS.
     */
    WEB_URL: z.url().optional(),
    CORS_ORIGENS: z.string().optional(),

    /** Ed25519 (PKCS8 PEM). O `kid` sai da própria chave. */
    JWT_CHAVE_PRIVADA: pem,
    /** JSON `["<PEM público>", …]` das chaves anteriores, aceitas até os tokens expirarem. */
    JWT_CHAVES_ANTERIORES: z.string().optional(),
    JWT_EMISSOR: z.string().default("erp-ssw"),
    JWT_AUDIENCIA: z.string().default("erp-ssw-web"),
    /** Base pública dos logos (bucket S3); sem ela o menu mostra as iniciais da empresa. */
    LOGO_URL_BASE: z.url().optional(),
    /** Bucket S3 compatível dos logos (envio pela Plataforma). Sem ele, o envio avisa. */
    S3_ENDPOINT: z.url().optional(),
    S3_REGIAO: z.string().default("us-east-1"),
    S3_BUCKET: z.string().optional(),
    S3_CHAVE_ACESSO: z.string().optional(),
    S3_SEGREDO: z.string().optional(),
    S3_CAMINHO_NO_ESTILO: booleano.default(false),

    /** Token de leitura de /metrics; sem ele a rota não existe. */
    METRICAS_TOKEN: z.string().min(16).optional(),

    /**
     * Chaves mestras: "1:<base64 de 32 bytes>,2:<…>". Cifram os segredos das integrações (das
     * empresas e da Plataforma). Nunca vão para o banco.
     */
    SEGREDOS_CHAVES: z.string().optional(),
    /** Versão da chave usada para cifrar segredos novos (padrão: a maior). */
    SEGREDOS_CHAVE_ATUAL: z.coerce.number().int().positive().optional(),
    /**
     * Jobs do ERP no processo da API (ADR 0012): workers do BullMQ ligados nesta réplica. Os
     * agendados (cron) só com `AGENDAMENTOS_LIGADOS` também.
     */
    JOBS_LIGADOS: booleano.default(false),
    AGENDAMENTOS_LIGADOS: booleano.default(false),
    /** Transição da FR: credencial do Ahgora no ambiente (só com parametros.usar_env). */
    AHGORA_API_USUARIO: z.string().optional(),
    AHGORA_API_SENHA: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && !env.REDIS_URL) {
      ctx.addIssue({ code: "custom", message: "Em produção, REDIS_URL é obrigatório." });
    }
    if (env.JOBS_LIGADOS && !env.REDIS_URL) {
      ctx.addIssue({ code: "custom", message: "JOBS_LIGADOS precisa de REDIS_URL." });
    }
    const s3 = [env.S3_BUCKET, env.S3_CHAVE_ACESSO, env.S3_SEGREDO];
    if (s3.some(Boolean) && !s3.every(Boolean)) {
      ctx.addIssue({
        code: "custom",
        message: "S3: defina S3_BUCKET, S3_CHAVE_ACESSO e S3_SEGREDO.",
      });
    }
    if (env.NODE_ENV === "production" && !env.SEGREDOS_CHAVES) {
      ctx.addIssue({ code: "custom", message: "Em produção, SEGREDOS_CHAVES é obrigatório." });
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
  const web = ambiente.WEB_URL ? [new URL(ambiente.WEB_URL).origin] : [];
  return [...web, ...extras.filter(Boolean)];
}
