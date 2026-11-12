import { z } from "./zod";

/**
 * Jobs do ERP que os módulos da API pedem e os workers do BullMQ no processo da API rodam (ADR
 * 0012): o nome e a fila são o contrato entre os dois. Escopo empresa: os dados levam `empresaId`
 * e o job roda no contexto (RLS) dela.
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

/**
 * Recalcula pelo núcleo os CT-e que têm o código (numa ocorrência ou como efetiva), depois que a
 * descrição ou o tipo SSW dele mudou no catálogo (Q20). Lê o catálogo no processamento: repetir é
 * seguro. Mesma fila da propagação, que roda antes (um job por vez, na ordem).
 */
export const JOB_RECALCULAR_CTES_DO_CODIGO = {
  nome: "recalcular-ctes-do-codigo",
  fila: "recalculo",
} as const;
