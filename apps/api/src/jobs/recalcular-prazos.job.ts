import { JOB_RECALCULAR_PRAZOS } from "@erp/shared/jobs";
import { z } from "@erp/shared/zod";

import { recalcularPrevisoesPelosPrazos } from "../models/prazos/recalculo-de-prazos.service";
import { definirJob } from "./registro";

/** Por empresa, sob demanda (o Admin pede ao mexer numa regra de prazo configurado). */
export const recalcularPrazos = definirJob({
  nome: JOB_RECALCULAR_PRAZOS.nome,
  fila: JOB_RECALCULAR_PRAZOS.fila,
  escopo: "empresa",
  dados: z.object({ empresaId: z.uuid() }),
  agendamento: null,
  async processar({ executar, log }, { empresaId }) {
    const resultado = await recalcularPrevisoesPelosPrazos(executar, empresaId);
    log.info(resultado, "previsões recalculadas pelos prazos configurados");
  },
});
