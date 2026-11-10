import { z } from "../zod";

/**
 * Jobs de recálculo em lote que a API enfileira e o worker processa (fila própria, para não
 * atrasar a ingestão nem a manutenção).
 */
export const FILA_DE_RECALCULO = "recalculo";

/**
 * Regrava `penaliza`/`responsavel` em todas as ocorrências dos códigos, com a classificação do
 * catálogo no momento do processamento (idempotente: pode repetir).
 */
export const JOB_PROPAGAR_CLASSIFICACAO = "propagar-classificacao-codigo";

export const dadosDePropagarClassificacao = z.object({
  empresaId: z.uuid(),
  codigos: z.array(z.number().int().min(0).max(99)).min(1),
});
export type DadosDePropagarClassificacao = z.infer<typeof dadosDePropagarClassificacao>;
