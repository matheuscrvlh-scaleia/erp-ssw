import { z } from "./zod";

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

/**
 * Regrava `penaliza`/`responsavel` em todas as ocorrências dos códigos, com a classificação do
 * catálogo no momento do processamento (idempotente: pode repetir). Fila própria, para não
 * atrasar a ingestão nem a manutenção.
 */
export const JOB_PROPAGAR_CLASSIFICACAO = {
  nome: "propagar-classificacao-codigo",
  fila: "recalculo",
} as const;

export const dadosDePropagarClassificacao = z.object({
  empresaId: z.uuid(),
  codigos: z.array(z.number().int().min(0).max(99)).min(1),
});
export type DadosDePropagarClassificacao = z.infer<typeof dadosDePropagarClassificacao>;
