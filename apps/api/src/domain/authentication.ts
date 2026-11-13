/** Falhas seguidas toleradas antes do primeiro bloqueio de uma conta (ou e-mail). */
export const FALHAS_TOLERADAS_POR_CONTA = 5;
/** Por IP tolera mais: um escritório inteiro sai pelo mesmo IP. */
export const FALHAS_TOLERADAS_POR_IP = 20;
const BLOQUEIO_MAXIMO_MS = 60 * 60_000;

/**
 * Bloqueio progressivo: ao atingir o limite de falhas seguidas, 1 min; depois 2, 4, 8… até 1 h.
 * Vale igual para conta existente e para e-mail que não existe (senão o bloqueio revela quem
 * tem conta).
 */
export function duracaoDoBloqueioMs(
  falhasSeguidas: number,
  toleradas: number = FALHAS_TOLERADAS_POR_CONTA,
): number {
  if (falhasSeguidas < toleradas) return 0;
  const expoente = falhasSeguidas - toleradas;
  return Math.min(60_000 * 2 ** expoente, BLOQUEIO_MAXIMO_MS);
}

/** E-mail como chave de conta: sem espaços e em minúsculas (o banco guarda assim). */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Um login vale no máximo 8 h, contadas da entrada; renovar não estende. */
export const DURACAO_DA_SESSAO_MS = 8 * 60 * 60_000;
/** Sem uso por 30 min, a sessão cai (o painel renova a cada 10 min enquanto há uso). */
export const INATIVIDADE_MAXIMA_MS = 30 * 60_000;
export const RENOVAR_COM_USO_A_CADA_MS = 10 * 60_000;

/** A sessão ficou ociosa se a última renovação passou do limite de inatividade. */
export function sessaoOciosa(ultimaRenovacao: Date, agora: Date): boolean {
  return agora.getTime() - ultimaRenovacao.getTime() > INATIVIDADE_MAXIMA_MS;
}
