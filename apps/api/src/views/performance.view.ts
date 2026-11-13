import { type SaidaDe } from "@erp/shared/contract";
import { type contratosPerformance, type LinhaExportacao } from "@erp/shared/contracts/performance";

import {
  type CteComOcorrencias,
  type ExportacaoDaTela,
} from "../models/performance/performance.service";

const numeroOuNulo = (v: string | null) => (v === null ? null : Number(v));

/** Uma linha por ocorrência do CT-e; CT-e sem ocorrência sai numa linha só. */
function linhasDoCte({ cte: c, ocorrencias }: CteComOcorrencias): LinhaExportacao[] {
  const base = {
    numeroNf: c.numeroNf,
    numero: c.numero,
    sigla: c.sigla,
    dataEmissao: c.dataEmissao,
    unidade: c.filial,
    remetente: c.remetente,
    destinatario: c.destinatario,
    cidadeDestino:
      c.cidadeDestino && c.ufDestino ? `${c.cidadeDestino}/${c.ufDestino}` : c.cidadeDestino,
    peso: numeroOuNulo(c.peso),
    volumes: c.volumes,
    valorFrete: numeroOuNulo(c.valorFrete),
    placaRomaneio: null,
    motorista: null,
    placaColeta: c.placaColeta,
    placaEntrega: c.placaEntrega,
    cteVinculo: c.numeroCte === null ? null : `${c.siglaCte ?? ""}${c.numeroCte}`,
    romaneio: null,
    status: c.statusAtual,
  };
  if (ocorrencias.length === 0) return [{ ...base, codigo: null, descricao: null, dataHora: null }];
  return ocorrencias.map((o) => ({
    ...base,
    codigo: o.codigo,
    descricao: o.descricao,
    dataHora: o.dataHora,
  }));
}

export function apresentarExportacao({
  ctes,
  truncado,
}: ExportacaoDaTela): SaidaDe<typeof contratosPerformance.exportacao> {
  return { linhas: ctes.flatMap(linhasDoCte), truncado };
}
