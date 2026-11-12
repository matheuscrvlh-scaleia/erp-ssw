import {
  dadosDePropagarClassificacao,
  JOB_PROPAGAR_CLASSIFICACAO,
  JOB_RECALCULAR_CTES_DO_CODIGO,
} from "@erp/shared/jobs";

import {
  cadastrosDoRecalculo,
  propagarClassificacaoDoCodigo,
  recalcularCtesPeloCodigo,
} from "../models/recalculo/recalculo.service";
import { definirJob } from "./registro";

/** Por empresa, sob demanda (o Admin pede ao mudar a classificação de códigos do catálogo). */
export const propagarClassificacao = definirJob({
  nome: JOB_PROPAGAR_CLASSIFICACAO.nome,
  fila: JOB_PROPAGAR_CLASSIFICACAO.fila,
  escopo: "empresa",
  dados: dadosDePropagarClassificacao,
  agendamento: null,
  async processar({ executar, log }, { empresaId, codigos }) {
    for (const codigo of codigos) {
      const regravadas = await propagarClassificacaoDoCodigo(executar, empresaId, codigo);
      log.info({ codigo, regravadas }, "classificação propagada");
    }
  },
});

/** Por empresa, sob demanda: os CT-e dos códigos acompanham o catálogo (Q20). */
export const recalcularCtesDoCodigo = definirJob({
  nome: JOB_RECALCULAR_CTES_DO_CODIGO.nome,
  fila: JOB_RECALCULAR_CTES_DO_CODIGO.fila,
  escopo: "empresa",
  dados: dadosDePropagarClassificacao,
  agendamento: null,
  async processar({ executar, log, agora }, { empresaId, codigos }) {
    const cadastros = await cadastrosDoRecalculo(executar);
    for (const codigo of codigos) {
      const gravados = await recalcularCtesPeloCodigo(
        executar,
        cadastros,
        empresaId,
        codigo,
        agora,
      );
      log.info({ codigo, gravados }, "CT-e recalculados pelo código");
    }
  },
});
