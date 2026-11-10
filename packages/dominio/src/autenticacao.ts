/** Falhas seguidas toleradas antes do primeiro bloqueio. */
export const FALHAS_ANTES_DO_BLOQUEIO = 5;
const BLOQUEIO_MAXIMO_MS = 60 * 60_000;

/**
 * Bloqueio progressivo: a partir da 5ª falha seguida, 1 min, 2, 4, 8… até 1 h. Vale igual para
 * conta e para IP, e para e-mail que não existe (senão o bloqueio revela quem tem conta).
 */
export function duracaoDoBloqueioMs(falhasSeguidas: number): number {
  if (falhasSeguidas < FALHAS_ANTES_DO_BLOQUEIO) return 0;
  const expoente = falhasSeguidas - FALHAS_ANTES_DO_BLOQUEIO;
  return Math.min(60_000 * 2 ** expoente, BLOQUEIO_MAXIMO_MS);
}

/** E-mail como chave de conta: sem espaços e em minúsculas (o banco guarda assim). */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Hash bcrypt de antes (Supabase Auth): validado no 1º login e regravado em argon2id. */
export function ehHashBcrypt(hash: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(hash);
}
