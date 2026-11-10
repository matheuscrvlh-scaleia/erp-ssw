/**
 * Jobs de outros domínios que a ingestão enfileira. Os jobs da própria ingestão (nomes, filas,
 * horários) estão no catálogo `@erp/shared/ingestao`.
 */

/**
 * Recálculo das projeções do Romaneio (job do worker `projecoes-romaneio`): a ingestão enfileira
 * as chaves que mudaram no 036/038/306/455 e no CT-e, até `maxChaves` por job.
 */
export const JOB_PROJECOES = {
  fila: "projecoes",
  nome: "projecoes-romaneio",
  maxChaves: 50_000,
} as const;

// TODO(coletas): o job é do domínio de Coletas (leitor e gravação do 050).
export const JOB_COLETAS_050 = { fila: "coletas", nome: "coletas.importar-050" } as const;
