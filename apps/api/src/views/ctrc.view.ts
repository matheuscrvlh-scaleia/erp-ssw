import { type SaidaDe } from "@erp/shared/contract";
import { type contratosCtrc, type DetalheCtrc } from "@erp/shared/contracts/ctrc";

import { type BuscaDoCtrc, type DetalheDoCtrc } from "../models/ctrc/ctrc.service";

/** O detalhe como a tela vê: nomes da tela e instantes em ISO. */
function apresentarDetalhe(d: DetalheDoCtrc): DetalheCtrc {
  const { ctrc: c, romaneio, bi2 } = d;
  return {
    id: c.id,
    sigla: c.sigla,
    numero: c.numero,
    numeroNf: c.numeroNf,
    chave: c.chave,
    chaveNfe: c.chaveNfe,
    dataEmissao: c.dataEmissao,
    dataEmbarque: c.dataEmbarque,
    statusAtual: c.statusAtual,
    prazoContratadoDias: c.prazoContratadoDias,
    dataPrevista: c.dataPrevistaEntrega,
    prazoOrigem: c.prazoOrigem,
    prazoFonte: c.prazoFonte,
    prazoPadraoDias: c.prazoPadraoDias,
    prazoPadraoData: c.prazoPadraoData,
    dataEntrega: c.dataEntregaRealizada?.toISOString() ?? null,
    performanceDias: c.performanceDias,
    atrasoDias: d.atrasoDias,
    noPrazo: c.noPrazo,
    responsabilidadeCliente: c.responsabilidadeCliente,
    fontePerformance: c.fontePerformance,
    unidadeOrigem: c.unidadeOrigem,
    unidadeDestino: c.unidadeDestino,
    unidadeAtual: c.unidadeAtual,
    filial: c.filial,
    unidadeCidade: c.unidadeCidade,
    unidadeUf: c.unidadeUf,
    localizacao: d.localizacao,
    remetente: c.remetente,
    destinatario: c.destinatario,
    logradouroDestino: c.logradouroDestino,
    numeroEnderecoDestino: c.numeroEnderecoDestino,
    complementoDestino: c.complementoDestino,
    bairroDestino: c.bairroDestino,
    cidadeDestino: c.cidadeDestino,
    ufDestino: c.ufDestino,
    cepDestinatario: c.cepDestinatario,
    setor: c.setor,
    setorDestino: c.setorDestino,
    peso: c.peso,
    volumes: c.volumes,
    valorFrete: c.valorFrete,
    valorMercadoria: c.valorMercadoria,
    primeiroManifesto: c.primeiroManifesto,
    ultimoManifesto: c.ultimoManifesto,
    parceiroNome: c.parceiroNome,
    parceiroCnpj: c.parceiroCnpj,
    parceiro: c.parceiro,
    placa: romaneio?.placa ?? null,
    motorista: romaneio?.motorista ?? null,
    romaneio: romaneio?.romaneio ?? null,
    efetiva: { ...d.efetiva, dataHora: d.efetiva.dataHora?.toISOString() ?? null },
    finalizacao: d.finalizacao,
    codigosBaixa: [...d.codigosBaixa].sort((a, b) => a - b),
    ocorrencias: d.ocorrencias.map((o) => ({
      id: o.id,
      codigo: o.codigo,
      descricao: o.descricao,
      dataHora: o.dataHora.toISOString(),
      responsavel: o.responsavel,
      penaliza: o.penaliza,
    })),
    bi2: bi2 && {
      codigoRelatorio: bi2.codigoRelatorio,
      dataAlvo: bi2.dataAlvo,
      atualizadoEm: bi2.atualizadoEm.toISOString(),
    },
    criadoEm: c.criadoEm.toISOString(),
    atualizadoEm: c.atualizadoEm.toISOString(),
  };
}

export function apresentarBuscaDoCtrc(busca: BuscaDoCtrc): SaidaDe<typeof contratosCtrc.detalhe> {
  return busca.tipo === "encontrado"
    ? { tipo: "encontrado", ctrc: apresentarDetalhe(busca.detalhe) }
    : busca;
}
