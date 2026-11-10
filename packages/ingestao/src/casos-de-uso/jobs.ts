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

// TODO(coletas): falta o consumidor no worker (as regras já existem: `lerRelatorio050` e
// `planejarGravacao050` em `@erp/dominio/coletas`; hoje só a importação manual da tela usa).
export const JOB_COLETAS_050 = { fila: "coletas", nome: "coletas.importar-050" } as const;
