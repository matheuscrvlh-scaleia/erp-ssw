import { type PassoFinal } from "../motor/executar";
import { conferirColunasCalculadas } from "./recalculo";

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

export const PASSOS_FINAIS: readonly PassoFinal[] = [
  recalcularProjecoes,
  conferirColunasCalculadas,
];
