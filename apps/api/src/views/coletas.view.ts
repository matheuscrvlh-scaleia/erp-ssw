import { type SaidaDe } from "@erp/shared/contrato";
import { type contratosColetas, type LinhaDeColeta } from "@erp/shared/contratos/coletas";

import {
  type ColetaDaLista,
  type DetalheComHistorico,
  type ImportacaoDo050,
  type ListaDeColetas,
  type PainelDasColetas,
} from "../models/coletas/coletas.service";

/** Avisos do 050 que a tela mostra depois da importação. */
const AVISOS_NA_TELA = 50;

const iso = (d: Date | null) => d?.toISOString() ?? null;

export function apresentarPainelDeColetas({
  indicadores,
  resumo,
}: PainelDasColetas): SaidaDe<typeof contratosColetas.painel> {
  return {
    ...indicadores,
    opcoes: { unidades: resumo.unidades, solicitantes: resumo.solicitantes },
    posicaoEm: iso(resumo.posicaoEm),
    cobertura: { inicio: resumo.coberturaInicio, fim: resumo.coberturaFim },
  };
}

function apresentarColeta(c: ColetaDaLista): LinhaDeColeta {
  return {
    unidade: c.unidade,
    numero: c.numero,
    tipo: c.tipo,
    etapa: c.etapa,
    statusPrazo: c.statusPrazo,
    cadastradaEm: iso(c.cadastradaEm),
    limiteEm: iso(c.limiteEm),
    coletadaEm: iso(c.coletadaEm),
    canceladaEm: iso(c.canceladaEm),
    solicitante: c.solicitante,
    remetenteCnpj: c.remetenteCnpj,
    remetenteNome: c.remetenteNome,
    remetenteCidade: c.remetenteCidade,
    destinatarioNome: c.destinatarioNome,
    destinoCidade: c.destinoCidade,
    motorista: c.motorista,
    placa: c.placa,
    volumes: c.volumes,
    pesoKg: c.pesoKg,
    valorMercadoria: c.valorMercadoria,
    tipoFrete: c.tipoFrete,
    notasFiscais: c.notasFiscais,
    cteSigla: c.cteSigla,
    cteNumero: c.cteNumero,
    cteTipoDocumento: c.tipoDaTela,
    cteEmissao: c.cteEmissao,
    prejudicadaHorario: c.prejudicadaHorario,
    ultimoEvento: c.ultimoEvento,
  };
}

export function apresentarListaDeColetas(
  lista: ListaDeColetas,
): SaidaDe<typeof contratosColetas.lista> {
  return { total: lista.total, linhas: lista.linhas.map(apresentarColeta) };
}

export function apresentarExportacaoDeColetas(
  linhas: ColetaDaLista[],
): SaidaDe<typeof contratosColetas.exportar> {
  return { linhas: linhas.map(apresentarColeta) };
}

export function apresentarDetalheDaColeta(
  d: DetalheComHistorico,
): SaidaDe<typeof contratosColetas.detalhe> {
  return {
    observacao: d.observacao,
    mercadoria: d.mercadoria,
    setor: d.setor,
    romaneio: d.romaneio,
    cadastradaPor: d.cadastradaPor,
    comandadaEm: iso(d.comandadaEm),
    limiteInicial: d.limiteInicial,
    relatorioEmitidoEm: d.relatorioEmitidoEm.toISOString(),
    historico: d.historico,
  };
}

export function apresentarImportacaoDo050({
  relatorio,
  unidades,
  lidas,
  gravadas,
  ignoradas,
}: ImportacaoDo050): SaidaDe<typeof contratosColetas.importar050> {
  return {
    emitidoEm: relatorio.emitidoEm,
    periodoCadastro: relatorio.periodoCadastro,
    periodoColeta: relatorio.periodoColeta,
    unidades,
    lidas,
    gravadas,
    ignoradas,
    resumoSsw: relatorio.resumo,
    avisos: relatorio.avisos.slice(0, AVISOS_NA_TELA),
  };
}
