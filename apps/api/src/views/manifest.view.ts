import { type EventoDaLinhaDoTempo } from "@erp/domain/manifest/timeline";
import { type SaidaDe } from "@erp/shared/contract";
import {
  type contratosRomaneio,
  type LinhaExportada,
  type LinhaLista,
} from "@erp/shared/contracts/manifest";

import {
  type ExportacaoDoRomaneio,
  type LinhaDoRomaneio,
  type ListaDoRomaneio,
  type OpcoesDoRomaneio,
} from "../models/manifest/manifest.service";

type Saida<K extends keyof typeof contratosRomaneio> = SaidaDe<(typeof contratosRomaneio)[K]>;

const FONTES = ["bi2_0174", "bi2_0013", "webhook"] as const;
const ehFonte = (f: string | null | undefined): f is (typeof FONTES)[number] =>
  FONTES.some((x) => x === f);

/** Linha da aba Total: o fato, as colunas de exibição e a ocorrência efetiva numa linha só. */
function apresentarLinha({
  fato: f,
  analise: a,
  detalhe: d,
  ocorrencia,
}: LinhaDoRomaneio): LinhaLista {
  const fonte = d?.ocorrEfetivaFonte;
  return {
    id: f.id,
    sigla: f.sigla,
    numero: f.numero,
    numeroNf: f.numeroNf,
    dataEmissao: f.dataEmissao,
    dataEmbarque: f.dataEmbarque,
    dataPrevista: f.dataPrevista,
    dataEntregaRealizada: f.dataEntregaRealizada?.toISOString() ?? null,
    parceiroId: f.parceiroId,
    parceiroNome: f.parceiroNome,
    unidadeId: f.unidadeId,
    filial: f.filial,
    unidadeCidade: d?.unidadeCidade ?? null,
    unidadeUf: d?.unidadeUf ?? null,
    unidadeAtual: d?.unidadeAtual ?? null,
    placa: d?.placa ?? null,
    motorista: d?.motorista ?? null,
    remetente: f.remetente,
    destinatario: d?.destinatario ?? null,
    cidadeDestino: f.cidadeDestino,
    ufDestino: f.ufDestino,
    setor: f.setor,
    bairro: d?.bairro ?? null,
    endereco: d?.endereco ?? null,
    valorMercadoria: d?.valorMercadoria ?? null,
    peso: f.peso,
    volumes: f.volumes,
    valorFrete: f.valorFrete,
    tde: f.tde,
    statusAtual: f.statusAtual,
    ultimaOcorrencia: ocorrencia && {
      ...ocorrencia,
      dataHora: d?.ocorrEfetivaData?.toISOString() ?? null,
      fonte: ehFonte(fonte) ? fonte : null,
    },
    baixadoSemEntrega: a.finalizado,
    emRotaAgora: a.emRotaAgora,
    atrasoDias: d?.atrasoDias ?? null,
    performanceDias: d?.performanceDias ?? null,
    responsabilidadeCliente: d?.responsabilidadeCliente ?? null,
  };
}

export function apresentarLista(lista: ListaDoRomaneio): Saida<"lista"> {
  return { ...lista, linhas: lista.linhas.map(apresentarLinha) };
}

/** A linha da lista com as colunas a mais da planilha. */
function apresentarLinhaExportada(linha: LinhaDoRomaneio): LinhaExportada {
  return {
    ...apresentarLinha(linha),
    pagador: linha.fato.pagadorNome,
    cep: linha.detalhe?.cep ?? null,
    placaColeta: linha.detalhe?.placaColeta ?? null,
    placaEntrega: linha.detalhe?.placaEntrega ?? null,
  };
}

export function apresentarExportacao(exportacao: ExportacaoDoRomaneio): Saida<"exportar"> {
  return { ...exportacao, linhas: exportacao.linhas.map(apresentarLinhaExportada) };
}

/** Códigos do filtro: só código e descrição, em ordem de código. */
export function apresentarOpcoes(opcoes: OpcoesDoRomaneio): Saida<"opcoes"> {
  return {
    ...opcoes,
    codigos: opcoes.codigos
      .map((c) => ({ codigo: c.codigo, descricao: c.descricao }))
      .sort((a, b) => a.codigo - b.codigo),
  };
}

export function apresentarLinhaDoTempo(eventos: EventoDaLinhaDoTempo[]): Saida<"linhaDoTempo"> {
  return eventos.map((ev) => ({ ...ev, dataHora: ev.dataHora.toISOString() }));
}
