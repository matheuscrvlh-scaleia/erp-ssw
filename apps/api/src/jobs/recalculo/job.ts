import { type CteGravado, regravarCte } from "@erp/dominio/nucleo";
import {
  dadosDePropagarClassificacao,
  JOB_PROPAGAR_CLASSIFICACAO,
  JOB_RECALCULAR_CTES_DO_CODIGO,
} from "@erp/shared/jobs";

import { definirJob } from "../registro";

export interface RepositorioRecalculo {
  /**
   * Regrava `penaliza`/`responsavel` de até `limite` ocorrências do código que divergem do
   * catálogo; devolve quantas regravou (zero = acabou).
   */
  propagarClassificacao(empresaId: string, codigo: number, limite: number): Promise<number>;
  /**
   * CT-e da empresa com o código numa ocorrência ou como efetiva, em ordem de id a partir de
   * `aposId`.
   */
  ctesDoCodigo(
    empresaId: string,
    codigo: number,
    aposId: string | null,
    limite: number,
  ): Promise<CteGravado[]>;
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

/** CT-e por transação no recálculo: cada um lê as ocorrências e pode gravar. */
export const LOTE_DE_CTES = 500;

/**
 * Recalcula pelo núcleo (como numa gravação, fonte "outra") os CT-e que têm os códigos: a situação
 * e a descrição da efetiva acompanham o catálogo (Q20). CT-e igual não é regravado. Lotes de 500,
 * cada um numa transação.
 */
export const recalcularCtesDoCodigo = definirJob({
  nome: JOB_RECALCULAR_CTES_DO_CODIGO.nome,
  fila: JOB_RECALCULAR_CTES_DO_CODIGO.fila,
  escopo: "empresa",
  dados: dadosDePropagarClassificacao,
  agendamento: null,
  async processar({ executar, log, agora }, { empresaId, codigos }) {
    const contexto = await executar(({ cteNucleo }) => cteNucleo.cadastrosDoNucleo());
    for (const codigo of codigos) {
      let aposId: string | null = null;
      let gravados = 0;
      for (;;) {
        const lote: { ultimo: string | null; gravados: number } = await executar(
          async ({ recalculo, cteNucleo }) => {
            const ctes = await recalculo.ctesDoCodigo(empresaId, codigo, aposId, LOTE_DE_CTES);
            const ocorrencias = await cteNucleo.ocorrenciasDosCtes(ctes.map((c) => c.id));
            let alterados = 0;
            for (const antigo of ctes) {
              const resultado = await regravarCte(
                cteNucleo,
                contexto,
                antigo,
                {},
                ocorrencias.get(antigo.id) ?? [],
                agora(),
              );
              if (resultado.tipo === "gravado") alterados++;
            }
            return { ultimo: ctes.at(-1)?.id ?? null, gravados: alterados };
          },
        );
        gravados += lote.gravados;
        if (!lote.ultimo) break;
        aposId = lote.ultimo;
      }
      log.info({ codigo, gravados }, "CT-e recalculados pelo código");
    }
  },
});
