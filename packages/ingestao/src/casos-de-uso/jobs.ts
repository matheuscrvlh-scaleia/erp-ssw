/**
 * Jobs de outros domínios que a ingestão enfileira. Os jobs da própria ingestão (nomes, filas,
 * horários) estão no catálogo `@erp/shared/ingestao`.
 */

// TODO(romaneio): o job é do domínio de Romaneio (`recalcularProjecoesDoRomaneio`); a ingestão só
// enfileira as chaves que mudaram no 036/038/306 e no CT-e.
export const JOB_PROJECOES = { fila: "projecoes", nome: "projecoes.recalcular" } as const;

// TODO(coletas): o job é do domínio de Coletas (leitor e gravação do 050).
export const JOB_COLETAS_050 = { fila: "coletas", nome: "coletas.importar-050" } as const;
