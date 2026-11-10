import {
  calcularPainelDeColetas,
  type ColetaDaTela,
  statusDoPrazo,
  termosDaBusca,
} from "@erp/dominio/coletas/coletas";
import {
  importarRelatorio050 as importarColetas050,
  type RepositorioGravacao050,
} from "@erp/dominio/coletas/gravacao-050";
import { tipoDocumentoEfetivo } from "@erp/dominio/nucleo";
import { type SaidaDe } from "@erp/shared/contrato";
import {
  type contratosColetas,
  type EtapaDeColeta,
  eventoDeColeta,
  type FiltrosDeColetas,
  type LinhaDeColeta,
  type StatusDaLista,
  type StatusDePrazo,
} from "@erp/shared/contratos/coletas";
import { hojeNoFuso } from "@erp/shared/datas";
import { type z } from "@erp/shared/zod";

import { consultaAmplaDemais, naoEncontrado } from "../../http/erros";
import { type Executor } from "../../repositorios";

export const LIMITE_DE_COLETAS = 100_000;

/** Coleta gravada, com o CT-e gerado (se existir na base). */
export interface ColetaLida {
  unidade: string;
  numero: number;
  tipo: string;
  situacao: string | null;
  etapa: EtapaDeColeta;
  situacaoEm: Date | null;
  limiteEm: Date | null;
  cadastradaEm: Date | null;
  diaCadastro: string;
  coletadaEm: Date | null;
  canceladaEm: Date | null;
  solicitante: string | null;
  remetenteCnpj: string | null;
  remetenteNome: string | null;
  remetenteCidade: string | null;
  destinatarioNome: string | null;
  destinoCidade: string | null;
  motorista: string | null;
  placa: string | null;
  volumes: number | null;
  pesoKg: number | null;
  valorMercadoria: number | null;
  tipoFrete: string | null;
  notasFiscais: string | null;
  observacao: string | null;
  cteSigla: string | null;
  cteNumero: string | null;
  cteTipoDocumento455: string | null;
  cteTipoDocumento: string | null;
  cteEmissao: string | null;
  prejudicadaHorario: boolean;
  /** Texto do evento mais recente do histórico. */
  ultimoEvento: string | null;
}

export interface ResumoDasColetas {
  /** Todas as unidades com coleta na empresa. */
  unidades: string[];
  /** Solicitantes com cadastro no período (sem os outros filtros). */
  solicitantes: string[];
  posicaoEm: Date | null;
  coberturaInicio: string | null;
  coberturaFim: string | null;
}

export interface DetalheDaColeta {
  observacao: string | null;
  mercadoria: string | null;
  setor: string | null;
  romaneio: string | null;
  cadastradaPor: string | null;
  comandadaEm: Date | null;
  limiteInicial: string | null;
  relatorioEmitidoEm: Date;
  historico: unknown;
}

/** O que a lista de um card pede além dos filtros do painel. */
export interface PedidoDaLista {
  status: StatusDaLista;
  /** Termos de `termosDaBusca`; nulo = sem busca. */
  busca: { numero: string; cte: string; texto: string } | null;
  agora: Date;
  /** Hoje no fuso da empresa (vence hoje). */
  hoje: string;
  fuso: string;
}

/** Coleta da lista: com o prazo e o tipo do CT-e como a tela mostra. */
export type ColetaDaLista = ColetaLida & { statusPrazo: StatusDePrazo; tipoDaTela: string | null };

export interface RepositorioColetas extends RepositorioGravacao050 {
  coletas(empresaId: string, filtros: FiltrosDeColetas, limite: number): Promise<ColetaLida[]>;
  /**
   * Lista de um card filtrada (status e busca), ordenada (abertas pela que vence antes, depois as
   * mais recentes, unidade e número) e paginada no banco, com o total da lista inteira.
   */
  lista(
    empresaId: string,
    filtros: FiltrosDeColetas,
    pedido: PedidoDaLista,
    pagina: { limite: number; deslocamento: number },
  ): Promise<{ linhas: ColetaDaLista[]; total: number }>;
  resumo(empresaId: string, inicio: string, fim: string): Promise<ResumoDasColetas>;
  detalhe(empresaId: string, unidade: string, numero: number): Promise<DetalheDaColeta | null>;
}

export interface ContextoColetas {
  empresaId: string;
  fuso: string;
}

type Db = Executor<"coletas">;

const iso = (d: Date | null) => d?.toISOString() ?? null;

function paraATela(c: ColetaLida, agora: Date, fuso: string): ColetaDaTela & ColetaLida {
  return {
    ...c,
    statusPrazo: statusDoPrazo(c, agora, fuso),
    // CT-e não encontrado ou sem tipo: sem tipo (o agrupamento mostra vazio).
    cteTipoDocumento:
      c.cteEmissao === null
        ? null
        : tipoDocumentoEfetivo(c.cteTipoDocumento455, c.cteTipoDocumento),
  };
}

async function coletasDaTela(
  repo: RepositorioColetas,
  ctx: ContextoColetas,
  filtros: FiltrosDeColetas,
  agora: Date,
) {
  const coletas = await repo.coletas(ctx.empresaId, filtros, LIMITE_DE_COLETAS + 1);
  if (coletas.length > LIMITE_DE_COLETAS) throw consultaAmplaDemais();
  return coletas.map((c) => paraATela(c, agora, ctx.fuso));
}

/**
 * Painel de Coletas: cards, agrupamentos, opções, posição do 050 e cobertura.
 * origem: coletas_painel (sistema atual)
 */
export async function obterPainelDeColetas(
  db: Db,
  ctx: ContextoColetas,
  filtros: FiltrosDeColetas,
  agora: Date,
): Promise<SaidaDe<typeof contratosColetas.painel>> {
  return db(async ({ coletas }) => {
    const daTela = await coletasDaTela(coletas, ctx, filtros, agora);
    const resumo = await coletas.resumo(ctx.empresaId, filtros.inicio, filtros.fim);
    return {
      ...calcularPainelDeColetas(daTela),
      opcoes: { unidades: resumo.unidades, solicitantes: resumo.solicitantes },
      posicaoEm: iso(resumo.posicaoEm),
      cobertura: { inicio: resumo.coberturaInicio, fim: resumo.coberturaFim },
    };
  });
}

function paraALinha(c: ColetaDaLista): LinhaDeColeta {
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

type EntradaDaLista = z.output<typeof contratosColetas.exportar.entrada>;

function lerLista(
  repo: RepositorioColetas,
  ctx: ContextoColetas,
  entrada: EntradaDaLista,
  agora: Date,
  pagina: { limite: number; deslocamento: number },
) {
  return repo.lista(
    ctx.empresaId,
    entrada,
    {
      status: entrada.status,
      busca: termosDaBusca(entrada.busca),
      agora,
      hoje: hojeNoFuso(ctx.fuso, agora),
      fuso: ctx.fuso,
    },
    pagina,
  );
}

/**
 * Lista de coletas de um card, com busca, paginada no banco.
 * origem: coletas_lista (sistema atual)
 */
export async function obterListaDeColetas(
  db: Db,
  ctx: ContextoColetas,
  entrada: z.output<typeof contratosColetas.lista.entrada>,
  agora: Date,
): Promise<SaidaDe<typeof contratosColetas.lista>> {
  return db(async ({ coletas }) => {
    const { linhas, total } = await lerLista(coletas, ctx, entrada, agora, {
      limite: entrada.tamanho,
      deslocamento: (entrada.pagina - 1) * entrada.tamanho,
    });
    return { total, linhas: linhas.map(paraALinha) };
  });
}

/** Lista inteira de um card, numa leitura só, na ordem da tela (exportação). */
export async function exportarListaDeColetas(
  db: Db,
  ctx: ContextoColetas,
  entrada: EntradaDaLista,
  agora: Date,
): Promise<SaidaDe<typeof contratosColetas.exportar>> {
  return db(async ({ coletas }) => {
    const { linhas } = await lerLista(coletas, ctx, entrada, agora, {
      limite: LIMITE_DE_COLETAS + 1,
      deslocamento: 0,
    });
    if (linhas.length > LIMITE_DE_COLETAS) throw consultaAmplaDemais();
    return { linhas: linhas.map(paraALinha) };
  });
}

/** Histórico gravado do 050 (lista de eventos); o que não tiver o formato é ignorado. */
function eventosDoHistorico(historico: unknown) {
  return (Array.isArray(historico) ? historico : []).flatMap((e: unknown) => {
    const lido = eventoDeColeta.safeParse(e);
    return lido.success ? [lido.data] : [];
  });
}

export async function obterDetalheDaColeta(
  db: Db,
  ctx: ContextoColetas,
  unidade: string,
  numero: number,
): Promise<SaidaDe<typeof contratosColetas.detalhe>> {
  return db(async ({ coletas }) => {
    const d = await coletas.detalhe(ctx.empresaId, unidade, numero);
    if (!d) throw naoEncontrado("Coleta não encontrada.");
    return {
      observacao: d.observacao,
      mercadoria: d.mercadoria,
      setor: d.setor,
      romaneio: d.romaneio,
      cadastradaPor: d.cadastradaPor,
      comandadaEm: iso(d.comandadaEm),
      limiteInicial: d.limiteInicial,
      relatorioEmitidoEm: d.relatorioEmitidoEm.toISOString(),
      historico: eventosDoHistorico(d.historico),
    };
  });
}

/**
 * Importação do 050 pela tela (a do FTP é do worker-ssw).
 * origem: importar-050.server.ts + importar_coletas_050 (sistema atual)
 */
export async function importarRelatorio050(
  db: Db,
  ctx: ContextoColetas,
  entrada: z.output<typeof contratosColetas.importar050.entrada>,
  agora: Date,
): Promise<SaidaDe<typeof contratosColetas.importar050>> {
  return db(async ({ coletas }) => {
    const { relatorio, lidas, gravadas, ignoradas } = await importarColetas050(
      coletas,
      ctx.empresaId,
      entrada.conteudo,
      entrada.arquivoOrigem,
      agora,
    );
    return {
      emitidoEm: relatorio.emitidoEm,
      periodoCadastro: relatorio.periodoCadastro,
      periodoColeta: relatorio.periodoColeta,
      unidades: [...new Set(relatorio.coletas.map((c) => c.unidade))].sort(),
      lidas,
      gravadas,
      ignoradas,
      resumoSsw: relatorio.resumo,
      avisos: relatorio.avisos.slice(0, 50),
    };
  });
}
