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
