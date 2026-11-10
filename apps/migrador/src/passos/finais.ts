import { type PassoFinal } from "../motor/executar";

/**
 * Projeções do Romaneio e do detalhe: o migrador não copia matview; reconstrói com o mesmo caso
 * de uso do worker, a partir das stagings do `public`, e compara com a matview atual.
 * TODO(projecoes): o caso de uso de recálculo ainda não existe na main. Quando existir, chamar
 * aqui para `romaneio_viagens_cte`, `romaneio_cte_atual` e `cte_dados_relatorios` e comparar as
 * contagens com `mv_romaneio_viagem_ctrc`, `mv_romaneio_036_ctrc` e `mv_ctrc_staging_enriquecido`.
 * (`romaneio_saidas_cte` é cópia direta e já migra como tabela.)
 */
export const recalcularProjecoes: PassoFinal = {
  nome: "recalcular-projecoes",
  executar: () =>
    Promise.resolve([
      "PENDENTE: romaneio_viagens_cte, romaneio_cte_atual e cte_dados_relatorios ficam vazias " +
        "até o caso de uso de recálculo do worker existir (TODO(projecoes)).",
    ]),
};

/**
 * Colunas calculadas (`fora_universo`, `ocorr_efetiva_*`, `data_conclusao_efetiva`,
 * `prazo_padrao_*`, `penaliza`, `quarentena`...) foram copiadas como estão, para o primeiro dia
 * bater com o sistema atual. O de-para pede, no fim, o recálculo em lote pelo backend para
 * conferir (diferença vira relatório, não correção).
 * TODO(nucleo): `packages/dominio/src/nucleo` ainda não existe na main; quando existir, recalcular
 * aqui e listar os CT-e que mudam.
 */
export const conferirColunasCalculadas: PassoFinal = {
  nome: "conferir-colunas-calculadas",
  executar: () =>
    Promise.resolve([
      "PENDENTE: colunas calculadas copiadas da origem sem recálculo (TODO(nucleo)).",
    ]),
};

export const PASSOS_FINAIS: readonly PassoFinal[] = [
  recalcularProjecoes,
  conferirColunasCalculadas,
];
