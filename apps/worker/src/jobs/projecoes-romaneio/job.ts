import {
  recalcularProjecoesDoRomaneio,
  reconstruirProjecoesDoRomaneio,
} from "@erp/dominio/romaneio/projecoes";
import { z } from "@erp/shared/zod";

import { definirJob } from "../registro";

/** CT-e por lote da reconstrução completa (uma transação por lote). */
const TAMANHO_DO_LOTE = 500;

/**
 * Recálculo incremental das projeções do Romaneio (viagens, saídas, romaneio atual e dados
 * 038/455) dos CT-e cujas linhas a ingestão acabou de gravar. Sob demanda: a ingestão enfileira
 * com as chaves (TODO(ingestao): enfileirar ao fim de cada lote 036/306/038/455).
 * Substitui o refresh das matviews (Q38).
 */
export const recalcularProjecoesRomaneio = definirJob({
  nome: "projecoes-romaneio",
  fila: "projecoes",
  escopo: "empresa",
  dados: z.object({
    empresaId: z.uuid(),
    chaves: z
      .array(z.object({ sigla: z.string().min(1), numero: z.string().min(1) }))
      .min(1)
      .max(50_000),
  }),
  agendamento: null,
  async processar({ executar, log }, { chaves }) {
    const resumo = await executar(({ projecoesRomaneio }) =>
      recalcularProjecoesDoRomaneio(projecoesRomaneio, chaves),
    );
    log.info(resumo, "projeções do romaneio recalculadas");
  },
});

/**
 * Reconstrução completa diária (conciliação, Q38): percorre todo CT-e com linha guardada.
 * CT-e alterado aqui é divergência do incremental e vai para o log como aviso. Agendado só com
 * `AGENDAMENTOS_LIGADOS` (desligado por padrão).
 */
export const reconstruirProjecoesRomaneio = definirJob({
  nome: "projecoes-romaneio-completa",
  fila: "projecoes",
  escopo: "empresa",
  dados: z.object({ empresaId: z.uuid() }),
  agendamento: "30 2 * * *",
  async processar({ executar, log }) {
    const resumo = await reconstruirProjecoesDoRomaneio(
      (fn) => executar(({ projecoesRomaneio }) => fn(projecoesRomaneio)),
      TAMANHO_DO_LOTE,
    );
    if (resumo.alterados > 0) {
      log.warn(resumo, "reconstrução das projeções do romaneio achou divergência do incremental");
    } else {
      log.info(resumo, "projeções do romaneio conferidas");
    }
  },
});
