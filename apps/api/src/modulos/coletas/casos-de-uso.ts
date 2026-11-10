import {
  calcularPainelDeColetas,
  type ColetaDaTela,
  listarColetas,
  statusDoPrazo,
} from "@erp/dominio/coletas/coletas";
import {
  chaveDaColeta,
  type ColetaJaGravada,
  type ColetaParaGravar,
  planejarGravacao050,
} from "@erp/dominio/coletas/gravacao-050";
import { lerRelatorio050 } from "@erp/dominio/coletas/leitor-050";
import { tipoDocumentoEfetivo } from "@erp/dominio/ocorrencias/busca";
import { type SaidaDe } from "@erp/shared/contrato";
import {
  type contratosColetas,
  type EtapaDeColeta,
  eventoDeColeta,
  type FiltrosDeColetas,
  type LinhaDeColeta,
} from "@erp/shared/contratos/coletas";
import { SEM_TIPO_DOCUMENTO } from "@erp/shared/contratos/ocorrencias";
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

export interface RepositorioColetas {
  coletas(empresaId: string, filtros: FiltrosDeColetas, limite: number): Promise<ColetaLida[]>;
  resumo(empresaId: string, inicio: string, fim: string): Promise<ResumoDasColetas>;
  detalhe(empresaId: string, unidade: string, numero: number): Promise<DetalheDaColeta | null>;
  jaGravadas(
    empresaId: string,
    chaves: { unidade: string; numero: number }[],
  ): Promise<ColetaJaGravada[]>;
  /** Insere ou substitui pela chave (empresa, unidade, número). */
  gravar(empresaId: string, coletas: ColetaParaGravar[], agora: Date): Promise<void>;
}

export interface ContextoColetas {
  empresaId: string;
  fuso: string;
}

type Db = Executor<"coletas">;

const iso = (d: Date | null) => d?.toISOString() ?? null;

function paraATela(c: ColetaLida, agora: Date, fuso: string): ColetaDaTela & ColetaLida {
  const tipo = tipoDocumentoEfetivo(c.cteTipoDocumento455, c.cteTipoDocumento);
  return {
    ...c,
    statusPrazo: statusDoPrazo(c, agora, fuso),
    // CT-e não encontrado ou sem tipo: sem tipo (o agrupamento mostra vazio).
    cteTipoDocumento: c.cteEmissao === null || tipo === SEM_TIPO_DOCUMENTO ? null : tipo,
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

/**
 * Lista de coletas de um card, com busca.
 * origem: coletas_lista (sistema atual)
 */
export async function obterListaDeColetas(
  db: Db,
  ctx: ContextoColetas,
  entrada: z.output<typeof contratosColetas.lista.entrada>,
  agora: Date,
): Promise<SaidaDe<typeof contratosColetas.lista>> {
  return db(async ({ coletas }) => {
    const { linhas, total } = listarColetas(await coletasDaTela(coletas, ctx, entrada, agora), {
      status: entrada.status,
      busca: entrada.busca,
      pagina: entrada.pagina,
      tamanho: entrada.tamanho,
    });
    return {
      total,
      linhas: linhas.map((c): LinhaDeColeta => ({
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
        cteTipoDocumento: c.cteTipoDocumento,
        cteEmissao: c.cteEmissao,
        prejudicadaHorario: c.prejudicadaHorario,
        ultimoEvento: c.ultimoEvento,
      })),
    };
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

const BLOCO_DE_GRAVACAO = 500;

/**
 * Importação do 050 (manual pela tela; a do FTP usa as mesmas regras no worker). Sem auditoria,
 * como hoje: o efeito é só a tabela de coletas.
 * origem: importar-050.server.ts + importar_coletas_050 (sistema atual)
 */
export async function importarRelatorio050(
  db: Db,
  ctx: ContextoColetas,
  entrada: z.output<typeof contratosColetas.importar050.entrada>,
  agora: Date,
): Promise<SaidaDe<typeof contratosColetas.importar050>> {
  const relatorio = lerRelatorio050(entrada.conteudo, entrada.arquivoOrigem);
  return db(async ({ coletas }) => {
    const chaves = [...new Map(relatorio.coletas.map((c) => [chaveDaColeta(c), c])).values()];
    const jaGravadas = new Map<string, ColetaJaGravada>();
    for (let i = 0; i < chaves.length; i += BLOCO_DE_GRAVACAO) {
      for (const g of await coletas.jaGravadas(
        ctx.empresaId,
        chaves.slice(i, i + BLOCO_DE_GRAVACAO),
      )) {
        jaGravadas.set(chaveDaColeta(g), g);
      }
    }
    const plano = planejarGravacao050(relatorio, entrada.arquivoOrigem, jaGravadas);
    for (let i = 0; i < plano.gravar.length; i += BLOCO_DE_GRAVACAO) {
      await coletas.gravar(ctx.empresaId, plano.gravar.slice(i, i + BLOCO_DE_GRAVACAO), agora);
    }
    return {
      emitidoEm: relatorio.emitidoEm,
      periodoCadastro: relatorio.periodoCadastro,
      periodoColeta: relatorio.periodoColeta,
      unidades: [...new Set(relatorio.coletas.map((c) => c.unidade))].sort(),
      lidas: plano.lidas,
      gravadas: plano.gravar.length,
      ignoradas: plano.ignoradas,
      resumoSsw: relatorio.resumo,
      avisos: relatorio.avisos.slice(0, 50),
    };
  });
}
