import { z } from "@erp/shared/zod";

const esquema = z.object({
  LOG_NIVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  /** Leitura de public/auth/vault (papel com SELECT nesses schemas). */
  MIGRADOR_ORIGEM_URL: z.string().min(1),
  /** Escrita no erp: papel dono do schema (`erp_migracao`), que não passa pelo RLS. */
  MIGRADOR_DESTINO_URL: z.string().min(1),
  /** Mesmas chaves da API: `"1:<base64 32 bytes>,2:..."`. Obrigatório fora do --dry-run. */
  SEGREDOS_CHAVES: z.string().min(1).optional(),
  SEGREDOS_CHAVE_ATUAL: z.coerce.number().int().positive().optional(),
});

export type AmbienteDoMigrador = z.output<typeof esquema>;

/** Mensagem sem valores: o erro do zod nunca ecoa a conexão nem a chave. */
export function carregarAmbiente(fonte: Record<string, string | undefined>): AmbienteDoMigrador {
  const resultado = esquema.safeParse(fonte);
  if (!resultado.success) {
    const campos = [...new Set(resultado.error.issues.map((i) => i.path.join(".")))];
    throw new Error(`Configuração inválida: ${campos.join(", ")}.`);
  }
  return resultado.data;
}
