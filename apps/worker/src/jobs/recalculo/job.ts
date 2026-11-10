import { dadosDePropagarClassificacao, JOB_PROPAGAR_CLASSIFICACAO } from "@erp/shared/jobs";

import { definirJob } from "../registro";

export interface RepositorioRecalculo {
  /**
   * Regrava `penaliza`/`responsavel` de até `limite` ocorrências do código que divergem do
   * catálogo; devolve quantas regravou (zero = acabou).
   */
  propagarClassificacao(empresaId: string, codigo: number, limite: number): Promise<number>;
}

/** Lote por transação: curto o bastante para não segurar trava nem estourar o timeout. */
export const TAMANHO_DO_LOTE = 10_000;

/**
 * Propaga a classificação de códigos do catálogo para as ocorrências, em lotes de transações
 * curtas. Lê o catálogo no momento do processamento, então repetir é seguro.
 * origem: propagate_codigo_changes (sistema atual)
 */
export const propagarClassificacao = definirJob({
  nome: JOB_PROPAGAR_CLASSIFICACAO.nome,
  fila: JOB_PROPAGAR_CLASSIFICACAO.fila,
  escopo: "empresa",
  dados: dadosDePropagarClassificacao,
  agendamento: null,
  async processar({ executar, log }, { empresaId, codigos }) {
    for (const codigo of codigos) {
      let total = 0;
      for (;;) {
        const regravadas = await executar(({ recalculo }) =>
          recalculo.propagarClassificacao(empresaId, codigo, TAMANHO_DO_LOTE),
        );
        total += regravadas;
        if (regravadas < TAMANHO_DO_LOTE) break;
      }
      log.info({ codigo, regravadas: total }, "classificação propagada");
    }
  },
});
