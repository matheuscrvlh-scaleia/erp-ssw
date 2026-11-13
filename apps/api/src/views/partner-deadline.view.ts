import { type SaidaDe } from "@erp/shared/contract";
import {
  type contratosPrazoParceiro,
  type LinhaPrazo,
  type NascidoAtrasado,
} from "@erp/shared/contracts/partner-deadline";

import {
  type CteDoPrazo,
  type DetalheDoParceiro,
  type ExportacaoDoPrazo,
  type ListaDoPrazo,
  type OpcoesDoPrazo,
} from "../models/partner-deadline/partner-deadline.service";

type Saida<K extends keyof typeof contratosPrazoParceiro> = SaidaDe<
  (typeof contratosPrazoParceiro)[K]
>;

function apresentarLinha(c: CteDoPrazo): LinhaPrazo {
  return {
    id: c.id,
    sigla: c.sigla,
    numero: c.numero,
    parceiroNome: c.parceiroNome,
    dataEmissao: c.dataEmissao,
    dataEmbarque: c.dataEmbarque,
    dataPrevista: c.dataPrevista,
    prazoPadraoData: c.prazoPadraoData,
    diasAbaixoDoPadrao: c.diasAbaixoDoPadrao,
    nasceuAtrasado: c.nasceuAtrasado,
    prazoOrigem: c.prazoOrigem,
    statusAtual: c.statusAtual,
    setor: c.setor,
    unidadeNome: c.unidadeNome,
  };
}

export function apresentarLista(lista: ListaDoPrazo): Saida<"lista"> {
  return { linhas: lista.linhas.map(apresentarLinha), total: lista.total };
}

export function apresentarExportacao(exportacao: ExportacaoDoPrazo): Saida<"exportar"> {
  return { linhas: exportacao.linhas.map(apresentarLinha), truncada: exportacao.truncada };
}

/** Parceiros só com id e nome, em ordem de nome. */
export function apresentarOpcoes(opcoes: OpcoesDoPrazo): Saida<"opcoes"> {
  return {
    ...opcoes,
    parceiros: opcoes.parceiros
      .map(({ id, nome }) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  };
}

function apresentarNascido(c: CteDoPrazo): NascidoAtrasado {
  return {
    id: c.id,
    sigla: c.sigla,
    numero: c.numero,
    dataEmbarque: c.dataEmbarque,
    dataEmissao: c.dataEmissao,
    dataPrevista: c.dataPrevista,
    prazoPadraoData: c.prazoPadraoData,
    diasAbaixoDoPadrao: c.diasAbaixoDoPadrao,
    statusAtual: c.statusAtual,
    setor: c.setor,
    unidadeNome: c.unidadeNome,
    cidadeDestino: c.cidadeDestino,
    ufDestino: c.ufDestino,
  };
}

export function apresentarDetalhe(detalhe: DetalheDoParceiro): Saida<"detalhe"> {
  return { ...detalhe, nascidos: detalhe.nascidos.map(apresentarNascido) };
}
