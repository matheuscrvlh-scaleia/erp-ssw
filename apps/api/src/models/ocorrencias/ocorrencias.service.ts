import {
  padroesDoFiltroDeTexto,
  rotuloDoPagador,
  saneTipos,
  termoCtrc,
  termoNf,
  tipoDocumentoDoFiltro,
} from "@erp/dominio/ocorrencias/busca";
import { codigosDoCard } from "@erp/dominio/ocorrencias/card";
import {
  type CodigoDoCatalogo,
  codigosDaTela,
  codigosDeBaixa,
  lerListaDeInteiros,
} from "@erp/dominio/ocorrencias/catalogo";
import { calcularPainel, type CteDoPainel } from "@erp/dominio/ocorrencias/painel";
import { type Periodo, periodoDoMesAnterior } from "@erp/dominio/ocorrencias/periodo";
import { situacaoDoCte } from "@erp/dominio/ocorrencias/situacao";
import {
  type CampoData,
  type CodigoDoCard,
  type contratosOcorrencias,
  type FiltrosDeCte,
  type LinhaDeOcorrencia,
  type OrdemDaLista,
  type PainelDeOcorrencias,
  type Recortes,
} from "@erp/shared/contratos/ocorrencias";
import { hojeNoFuso } from "@erp/shared/datas";
import { type z } from "@erp/shared/zod";

import { consultaAmplaDemais } from "../erros";
import { type Executor } from "../repositorios";

/** Teto de linhas trazidas para a memória numa consulta (CT-e ou ocorrências). */
export const LIMITE_DE_LINHAS = 200_000;

/** Filtros de CT-e já normalizados para a consulta. */
export interface FiltroDeCtes {
  empresaId: string;
  campoData: CampoData;
  /** Um período (lista, ver códigos) ou dois (painel: atual + mês anterior). */
  periodos: Periodo[];
  unidades: string[];
  conferentes: string[];
  parceiros: string[];
  filiais: string[];
  /** Padrões ILIKE (qualquer um casa); nulo = sem filtro. */
  remetente: string[] | null;
  destino: string[] | null;
  /** Número do CT-e como gravado; nulo = sem filtro. */
  ctrc: string | null;
  nf: string | null;
}

/** CT-e lido para as telas de ocorrências (colunas gravadas; nada calculado no banco). */
export interface CteLido {
  id: string;
  sigla: string;
  numero: string;
  dataEmissao: string;
  dataPrevistaEntrega: string | null;
  dataEntregaRealizada: Date | null;
  codigoEfetivo: number | null;
  noPrazo: boolean | null;
  pagadorNome: string | null;
  pagadorCnpj: string | null;
  filialEfetiva: string | null;
  tipoDocumento455: string | null;
  tipoDocumento: string | null;
  /** `parceiros.nome`, senão o expedidor gravado no CT-e. */
  parceiroNome: string | null;
}

export interface OcorrenciaLida {
  id: string;
  cteId: string;
  codigo: number;
  descricao: string | null;
  dataHora: Date;
}

/** O que a lista detalhada pede além dos filtros de CT-e (as regras vão para o SQL). */
export interface PedidoDaLista {
  /** Tipos já saneados; vazio = sem filtro. */
  tipos: string[];
  recortes: Recortes;
  /** Catálogo da empresa: a classificação de cada código é a dele no momento da consulta. */
  catalogo: CodigoDoCatalogo[];
  codigosTela: number[];
  /** Códigos de baixa do catálogo (Q22). */
  baixas: number[];
  /** Hoje no fuso da empresa (atraso). */
  hoje: string;
  ordem: OrdemDaLista;
  direcao: "asc" | "desc";
}

/** Uma página da lista detalhada e o total da lista inteira. */
export interface ListaDeOcorrencias {
  linhas: LinhaDeOcorrencia[];
  total: number;
}

export interface UnidadeAtiva {
  id: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
}

export interface PagadorDoPeriodo {
  cnpj: string;
  cnpjFormatado: string;
  nome: string | null;
}

/** Opções dos seletores; código fora do catálogo vem sem descrição. */
export interface OpcoesDeOcorrencias {
  unidades: UnidadeAtiva[];
  pagadores: PagadorDoPeriodo[];
  codigos: { codigo: number; descricao: string | null }[];
}

export interface RepositorioOcorrencias {
  catalogo(empresaId: string): Promise<CodigoDoCatalogo[]>;
  /** Valor da configuração da empresa (ou da Plataforma); nulo se não houver. */
  configuracao(empresaId: string, chave: string): Promise<string | null>;
  /** CT-e do universo (não fora, filial própria) com os filtros; até `limite` linhas. */
  ctes(filtro: FiltroDeCtes, limite: number): Promise<CteLido[]>;
  /** Ocorrências fora de quarentena dos códigos dados, dos CT-e do filtro. */
  ocorrencias(filtro: FiltroDeCtes, codigos: number[], limite: number): Promise<OcorrenciaLida[]>;
  /**
   * Lista detalhada filtrada, classificada, ordenada e paginada no banco, com o total da lista
   * inteira (mesma regra de `montarLista`, dominio/ocorrencias/lista.ts).
   */
  lista(
    filtro: FiltroDeCtes,
    pedido: PedidoDaLista,
    pagina: { limite: number; deslocamento: number },
  ): Promise<ListaDeOcorrencias>;
  conferentes(empresaId: string, limite: number): Promise<string[]>;
  unidadesAtivas(empresaId: string): Promise<UnidadeAtiva[]>;
  pagadores(
    empresaId: string,
    filtro: { inicio: string; fim: string; unidades: string[]; filiais: string[] },
    limite: number,
  ): Promise<PagadorDoPeriodo[]>;
}

export interface ContextoOcorrencias {
  empresaId: string;
  fuso: string;
}

type Db = Executor<"ocorrencias">;

function normalizarFiltro(
  ctx: ContextoOcorrencias,
  f: FiltrosDeCte,
  periodos: Periodo[],
): FiltroDeCtes {
  const texto = (valor: string) => (valor.trim() === "" ? null : padroesDoFiltroDeTexto(valor));
  return {
    empresaId: ctx.empresaId,
    campoData: f.campoData,
    periodos,
    unidades: f.unidades,
    conferentes: f.conferentes,
    parceiros: f.parceiros,
    filiais: f.filiais,
    remetente: texto(f.remetente),
    destino: texto(f.destino),
    ctrc: termoCtrc(f.ctrc),
    nf: termoNf(f.nf),
  };
}

function comTeto<T>(linhas: T[]): T[] {
  if (linhas.length > LIMITE_DE_LINHAS) throw consultaAmplaDemais();
  return linhas;
}

interface CatalogoDaTela {
  porCodigo: Map<number, CodigoDoCatalogo>;
  codigosTela: number[];
  baixas: Set<number>;
}

async function catalogoDaTela(
  ocorrencias: RepositorioOcorrencias,
  empresaId: string,
): Promise<CatalogoDaTela> {
  const catalogo = await ocorrencias.catalogo(empresaId);
  const foraDaTela = lerListaDeInteiros(
    await ocorrencias.configuracao(empresaId, "ocorrencias_codigos_fora_da_tela"),
  );
  return {
    porCodigo: new Map(catalogo.map((c) => [c.codigo, c])),
    codigosTela: codigosDaTela(catalogo, foraDaTela),
    baixas: codigosDeBaixa(catalogo),
  };
}

/** CT-e lidos → o que as regras do painel usam; filtro de tipo de documento aplicado aqui. */
export function paraOPainel(
  ctes: readonly CteLido[],
  f: Pick<FiltrosDeCte, "campoData" | "tipos">,
  baixas: ReadonlySet<number>,
  hoje: string,
): (CteDoPainel & { lido: CteLido })[] {
  const tipos = saneTipos(f.tipos);
  return ctes
    .filter(
      (c) =>
        tipos.length === 0 ||
        tipos.includes(tipoDocumentoDoFiltro(c.tipoDocumento455, c.tipoDocumento)),
    )
    .flatMap((c) => {
      const dataBase = f.campoData === "prevista" ? c.dataPrevistaEntrega : c.dataEmissao;
      if (dataBase === null) return [];
      return [
        {
          id: c.id,
          dataBase,
          pagador: rotuloDoPagador(c.pagadorNome, c.pagadorCnpj),
          unidadeResp: c.filialEfetiva,
          noPrazo: c.noPrazo,
          situacao: situacaoDoCte(c, baixas, hoje),
          lido: c,
        },
      ];
    });
}

/**
 * Painel da tela Ocorrências (período atual e mesmo intervalo do mês anterior).
 * origem: ocorrencias_painel_v5 (sistema atual)
 */
export async function obterPainel(
  db: Db,
  ctx: ContextoOcorrencias,
  entrada: z.output<typeof contratosOcorrencias.painel.entrada>,
  agora: Date,
): Promise<PainelDeOcorrencias> {
  const atual = { inicio: entrada.inicio, fim: entrada.fim };
  const anterior = periodoDoMesAnterior(atual);
  const hoje = hojeNoFuso(ctx.fuso, agora);
  return db(async ({ ocorrencias }) => {
    const cat = await catalogoDaTela(ocorrencias, ctx.empresaId);
    const filtro = normalizarFiltro(ctx, entrada, [atual, anterior]);
    const ctes = paraOPainel(
      comTeto(await ocorrencias.ctes(filtro, LIMITE_DE_LINHAS + 1)),
      entrada,
      cat.baixas,
      hoje,
    );
    const eventos = comTeto(
      await ocorrencias.ocorrencias(filtro, cat.codigosTela, LIMITE_DE_LINHAS + 1),
    );
    return {
      periodoAnterior: anterior,
      codigosAcompanhados: cat.codigosTela.length,
      ...calcularPainel({
        ctes,
        ocorrencias: eventos,
        catalogo: cat.porCodigo,
        atual,
        anterior,
        recortes: entrada,
        codigosAcompanhados: cat.codigosTela.length,
      }),
    };
  });
}

type EntradaDaLista = z.output<typeof contratosOcorrencias.exportar.entrada>;

async function lerLista(
  ocorrencias: RepositorioOcorrencias,
  ctx: ContextoOcorrencias,
  entrada: EntradaDaLista,
  agora: Date,
  pagina: { limite: number; deslocamento: number },
) {
  const catalogo = await ocorrencias.catalogo(ctx.empresaId);
  const foraDaTela = lerListaDeInteiros(
    await ocorrencias.configuracao(ctx.empresaId, "ocorrencias_codigos_fora_da_tela"),
  );
  return ocorrencias.lista(
    normalizarFiltro(ctx, entrada, [{ inicio: entrada.inicio, fim: entrada.fim }]),
    {
      tipos: saneTipos(entrada.tipos),
      recortes: entrada,
      catalogo,
      codigosTela: codigosDaTela(catalogo, foraDaTela),
      baixas: [...codigosDeBaixa(catalogo)],
      hoje: hojeNoFuso(ctx.fuso, agora),
      ordem: entrada.ordem,
      direcao: entrada.direcao,
    },
    pagina,
  );
}

/**
 * Lista detalhada de ocorrências (só o período atual), com conferente e romaneio, paginada no
 * banco.
 * origem: ocorrencias_lista_v5 (sistema atual)
 */
export async function obterLista(
  db: Db,
  ctx: ContextoOcorrencias,
  entrada: z.output<typeof contratosOcorrencias.lista.entrada>,
  agora: Date,
): Promise<ListaDeOcorrencias> {
  return db(({ ocorrencias }) =>
    lerLista(ocorrencias, ctx, entrada, agora, {
      limite: entrada.tamanho,
      deslocamento: (entrada.pagina - 1) * entrada.tamanho,
    }),
  );
}

/** Lista detalhada inteira, numa leitura só, na ordem da tela (exportação). */
export async function exportarLista(
  db: Db,
  ctx: ContextoOcorrencias,
  entrada: EntradaDaLista,
  agora: Date,
): Promise<LinhaDeOcorrencia[]> {
  return db(async ({ ocorrencias }) => {
    const { linhas } = await lerLista(ocorrencias, ctx, entrada, agora, {
      limite: LIMITE_DE_LINHAS + 1,
      deslocamento: 0,
    });
    return comTeto(linhas);
  });
}

/**
 * Códigos por trás de um card, só com os filtros de CT-e.
 * origem: ocorrencias_codigos_bucket_v3 (sistema atual)
 */
export async function obterCodigosDoCard(
  db: Db,
  ctx: ContextoOcorrencias,
  entrada: z.output<typeof contratosOcorrencias.codigosDoCard.entrada>,
  agora: Date,
): Promise<CodigoDoCard[]> {
  const hoje = hojeNoFuso(ctx.fuso, agora);
  return db(async ({ ocorrencias }) => {
    const cat = await catalogoDaTela(ocorrencias, ctx.empresaId);
    const filtro = normalizarFiltro(ctx, entrada, [{ inicio: entrada.inicio, fim: entrada.fim }]);
    const ctes = new Map(
      paraOPainel(
        comTeto(await ocorrencias.ctes(filtro, LIMITE_DE_LINHAS + 1)),
        entrada,
        cat.baixas,
        hoje,
      ).map((c) => [c.id, c]),
    );
    const eventos = comTeto(
      await ocorrencias.ocorrencias(filtro, cat.codigosTela, LIMITE_DE_LINHAS + 1),
    ).flatMap((o) => {
      const cte = ctes.get(o.cteId);
      return cte ? [{ ...o, cteEmAtraso: cte.situacao.emAtraso }] : [];
    });
    return codigosDoCard(eventos, cat.porCodigo, entrada.card);
  });
}

const LIMITE_DE_PAGADORES = 500;

/**
 * Opções dos seletores: unidades ativas, pagadores do período (por emissão) e códigos da tela.
 * origem: getOcorrenciasOpcoes (src/features/ocorrencias, sistema atual)
 */
export async function obterOpcoes(
  db: Db,
  ctx: ContextoOcorrencias,
  entrada: z.output<typeof contratosOcorrencias.opcoes.entrada>,
): Promise<OpcoesDeOcorrencias> {
  return db(async ({ ocorrencias }) => {
    const cat = await catalogoDaTela(ocorrencias, ctx.empresaId);
    const pagadores = await ocorrencias.pagadores(ctx.empresaId, entrada, LIMITE_DE_PAGADORES);
    return {
      unidades: await ocorrencias.unidadesAtivas(ctx.empresaId),
      pagadores,
      codigos: cat.codigosTela.map((codigo) => ({
        codigo,
        descricao: cat.porCodigo.get(codigo)?.descricao ?? null,
      })),
    };
  });
}

const LIMITE_DE_CONFERENTES = 1000;

/** origem: ocorrencias_conferentes_opcoes (sistema atual) */
export async function listarConferentes(db: Db, ctx: ContextoOcorrencias): Promise<string[]> {
  return db(({ ocorrencias }) => ocorrencias.conferentes(ctx.empresaId, LIMITE_DE_CONFERENTES));
}
