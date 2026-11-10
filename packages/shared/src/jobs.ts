/**
 * Jobs que a API enfileira e o worker processa: o nome e a fila são o contrato entre os dois.
 * Escopo empresa: os dados levam `empresaId` e o worker roda no contexto (RLS) dela.
 */
export const JOB_RECALCULAR_PRAZOS = {
  nome: "recalcular-prazos-configurados",
  fila: "prazos",
} as const;

export interface JobEnfileiravel {
  nome: string;
  fila: string;
}

/** Política padrão: 5 tentativas com espera exponencial; histórico limitado no Redis. */
export const OPCOES_PADRAO_DO_JOB = {
  attempts: 5,
  backoff: { type: "exponential", delay: 30_000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
} as const;

/** Prefixo das chaves do BullMQ no Redis (API e worker). */
export const PREFIXO_DAS_FILAS = "erp";
