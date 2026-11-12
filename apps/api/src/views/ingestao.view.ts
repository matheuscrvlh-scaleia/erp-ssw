import { type SaidaDe } from "@erp/shared/contrato";
import {
  type AplicacaoDaIngestao,
  type ArquivoDaIngestao,
  type CicloDaIngestao,
  type contratosIngestao,
} from "@erp/shared/contratos/ingestao";

import {
  type AplicacaoLida,
  type ArquivoLido,
  type ArquivosXmlDaIngestao,
  type CicloLido,
  type FtpDaIngestao,
  type PipelineDaIngestao,
} from "../models/ingestao/ingestao.service";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function apresentarCiclo(x: CicloLido): CicloDaIngestao {
  return {
    ...x,
    primeiroArquivoEm: x.primeiroArquivoEm.toISOString(),
    ultimoArquivoEm: x.ultimoArquivoEm.toISOString(),
    fechadoEm: iso(x.fechadoEm),
    aplicadoEm: iso(x.aplicadoEm),
  };
}

export function apresentarArquivo(a: ArquivoLido): ArquivoDaIngestao {
  return { ...a, vistoEm: a.vistoEm.toISOString(), importadoEm: iso(a.importadoEm) };
}

export function apresentarPipeline(
  pipeline: PipelineDaIngestao,
): SaidaDe<typeof contratosIngestao.pipeline> {
  return {
    ciclos: pipeline.ciclos.map(apresentarCiclo),
    arquivos: pipeline.arquivos.map(apresentarArquivo),
    esperados: pipeline.esperados,
    filaPendente: pipeline.fila.pendentes,
    aplicacaoRodando: pipeline.fila.rodando,
  };
}

export function apresentarAplicacao(a: AplicacaoLida): AplicacaoDaIngestao {
  return { ...a, iniciadoEm: a.iniciadoEm.toISOString(), finalizadoEm: iso(a.finalizadoEm) };
}

export function apresentarAplicacoes(
  aplicacoes: AplicacaoLida[],
): SaidaDe<typeof contratosIngestao.aplicacoes> {
  return { aplicacoes: aplicacoes.map(apresentarAplicacao) };
}

export function apresentarFtp({
  situacao,
  historico,
}: FtpDaIngestao): SaidaDe<typeof contratosIngestao.ftp> {
  return {
    ...situacao,
    historico: historico.map((h) => ({
      ...h,
      executadoEm: h.executadoEm.toISOString(),
      finalizadoEm: iso(h.finalizadoEm),
    })),
  };
}

export function apresentarArquivosXml({
  arquivos,
  orfaos,
}: ArquivosXmlDaIngestao): SaidaDe<typeof contratosIngestao.arquivosXml> {
  return {
    arquivos: arquivos.map((a) => ({ ...a, criadoEm: a.criadoEm.toISOString() })),
    orfaos: { ...orfaos, maisAntigo: iso(orfaos.maisAntigo) },
  };
}
