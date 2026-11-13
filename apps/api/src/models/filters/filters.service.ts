import { padraoContem, padroesDeTexto } from "@erp/domain/listing/text";
import {
  type CampoDataTipoDocumento,
  type TipoDocumentoOpcao,
} from "@erp/shared/contracts/filters";

import { type CodigoCadastrado } from "../ctrc/ctrc.service";
import { type Executor } from "../repositories";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Filtros já escolhidos na tela que estreitam as opções (períodos por emissão). */
export interface ContextoDeOpcoes {
  inicio: string;
  fim: string;
  pagadores: string[] | null;
  remetente: string[] | null;
  destino: string[] | null;
  /** Filiais efetivas pedidas (sem cruzar com as próprias: as opções não usam o universo). */
  siglas: string[] | null;
  codigos: number[] | null;
}

export type CampoDataPagador = "emissao" | "embarque" | "prevista" | "saida" | "conclusao";

export interface FiltroDePagadores {
  periodo: { campo: CampoDataPagador; inicio: string | null; fim: string | null };
  /** Filiais efetivas aceitas (próprias ∩ pedidas). */
  siglas: string[];
  limite: number;
}

export interface PagadorAgrupado {
  cnpj: string;
  cnpjGravado: string | null;
  nome: string | null;
  qtd: number;
}

export interface RepositorioFiltros {
  /** Filiais efetivas com CT-e emitido no período (sem universo), em ordem. */
  siglasNoPeriodo(empresaId: string, f: Omit<ContextoDeOpcoes, "siglas">): Promise<string[]>;
  /** Filiais (coluna crua) de todos os CT-e: plano B quando a consulta do período falha. */
  filiaisDosCtes(empresaId: string): Promise<string[]>;
  sugestoes(
    empresaId: string,
    campo: "remetente" | "cidade_destino",
    contem: string | null,
    f: ContextoDeOpcoes | null,
    limite: number,
  ): Promise<string[]>;
  cidadesDasUnidades(empresaId: string, ids: readonly string[]): Promise<string[]>;
  /** Siglas pelos apelidos de cidade (cidade já em maiúsculas e sem acento). */
  siglasDasCidades(empresaId: string, cidades: readonly string[]): Promise<string[]>;
  pagadores(empresaId: string, f: FiltroDePagadores): Promise<PagadorAgrupado[]>;
  tiposDocumento(empresaId: string): Promise<TipoDocumentoOpcao[]>;
  tiposDocumentoNoPeriodo(
    empresaId: string,
    inicio: string,
    fim: string,
    campo: CampoDataTipoDocumento,
    fuso: string,
  ): Promise<TipoDocumentoOpcao[]>;
}

/** Filtros já escolhidos na tela (entrada validada de opções e sugestões). */
interface FiltrosDaTela {
  inicio?: string | undefined;
  fim?: string | undefined;
  parceiros?: string[] | undefined;
  remetente?: string | undefined;
  destino?: string | undefined;
  filiais?: string[] | undefined;
  codigos?: number[] | undefined;
}

interface PedidoDeSugestoes extends FiltrosDaTela {
  campo: "remetente" | "cidade_destino";
  q: string;
}

interface PedidoDePagadores {
  inicio?: string | undefined;
  fim?: string | undefined;
  /** Sigla ou id de `unidades`. */
  unidades?: string[] | undefined;
  filiais?: string[] | undefined;
  campoData: CampoDataPagador;
}

export interface OpcoesDosFiltros {
  filiais: string[];
  codigos: CodigoCadastrado[];
}

export interface ContextoFiltros {
  empresaId: string;
  /** Fuso da empresa: dia da entrega nos tipos do período (Q11). */
  fuso: string;
}

type Db = Executor<"ctrc" | "filtros">;

const SUGESTOES = 20;
const PAGADORES = 500;

const maiusculas = (s: string) => s.trim().toUpperCase();
const naoVazia = <T>(lista: readonly T[] | undefined): T[] | null =>
  lista && lista.length > 0 ? [...lista] : null;

/** "São José" → "SAO JOSE" (como `filial_alias` guarda a cidade). */
function cidadeNormalizada(cidade: string): string {
  return cidade
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toUpperCase();
}

export async function listarFiliaisProprias(db: Db, ctx: ContextoFiltros): Promise<string[]> {
  return db(({ ctrc }) => ctrc.filiaisProprias(ctx.empresaId));
}

export async function listarCodigos(db: Db, ctx: ContextoFiltros): Promise<CodigoCadastrado[]> {
  return db(({ ctrc }) => ctrc.catalogo(ctx.empresaId));
}

function contextoDeOpcoes(entrada: FiltrosDaTela): ContextoDeOpcoes | null {
  if (!entrada.inicio || !entrada.fim) return null;
  return {
    inicio: entrada.inicio,
    fim: entrada.fim,
    pagadores: naoVazia(entrada.parceiros),
    remetente: padroesDeTexto(entrada.remetente),
    destino: padroesDeTexto(entrada.destino),
    siglas: naoVazia(entrada.filiais?.map(maiusculas)),
    codigos: naoVazia(entrada.codigos),
  };
}

/**
 * Opções de "Unidade responsável": filiais próprias com CT-e no período (sem período, ou se a
 * consulta do período falhar, as filiais de todos os CT-e), mais as já escolhidas; e o catálogo.
 * origem: getFiltroOpcoes, unidades_disponiveis_ctrcs, listar_filiais_ctrcs (sistema atual)
 */
export async function obterOpcoes(
  db: Db,
  ctx: ContextoFiltros,
  entrada: FiltrosDaTela,
): Promise<OpcoesDosFiltros> {
  const { proprias, codigos } = await db(async ({ ctrc }) => ({
    proprias: new Set(await ctrc.filiaisProprias(ctx.empresaId)),
    codigos: await ctrc.catalogo(ctx.empresaId),
  }));
  const f = contextoDeOpcoes(entrada);
  const todas = () => db(({ filtros }) => filtros.filiaisDosCtes(ctx.empresaId));
  let siglas: string[];
  if (f === null) siglas = await todas();
  else {
    // A lista do período é conveniência: se demorar demais, vale a de todos os CT-e.
    siglas = await db(({ filtros }) => filtros.siglasNoPeriodo(ctx.empresaId, f)).catch(todas);
  }
  const escolhidas = (entrada.filiais ?? []).map(maiusculas);
  const filiais = [...new Set([...siglas.map(maiusculas), ...escolhidas])]
    .filter((s) => s !== "" && proprias.has(s))
    .sort((a, b) => a.localeCompare(b));
  return { filiais, codigos };
}

/**
 * Sugestões do autocompletar (remetente, cidade destino): valores distintos que contêm o texto,
 * dentro dos outros filtros da tela; o filtro do próprio campo não entra.
 * origem: getFiltroSugestoes, sugestoes_texto_ctrcs (sistema atual)
 */
export async function listarSugestoes(
  db: Db,
  ctx: ContextoFiltros,
  entrada: PedidoDeSugestoes,
): Promise<string[]> {
  const f = contextoDeOpcoes(entrada);
  const semOProprio =
    f === null
      ? null
      : entrada.campo === "remetente"
        ? { ...f, remetente: null }
        : { ...f, destino: null };
  return db(({ filtros }) =>
    filtros.sugestoes(
      ctx.empresaId,
      entrada.campo,
      padraoContem(entrada.q),
      semOProprio,
      SUGESTOES,
    ),
  );
}

/**
 * Pagadores (seletor "Parceiros") do período e das unidades, agrupados pelo CNPJ.
 * Unidade por id vira as siglas da cidade dela (apelidos de filial).
 * origem: getPagadoresOpcoes, listar_pagadores_ctrcs (sistema atual)
 */
export async function listarPagadores(
  db: Db,
  ctx: ContextoFiltros,
  entrada: PedidoDePagadores,
): Promise<PagadorAgrupado[]> {
  return db(async ({ ctrc, filtros }) => {
    let siglas = await ctrc.filiaisProprias(ctx.empresaId);
    const unidades = naoVazia(entrada.unidades);
    if (unidades) {
      const ids = unidades.filter((u) => UUID.test(u));
      const cidades = ids.length ? await filtros.cidadesDasUnidades(ctx.empresaId, ids) : [];
      const pelasCidades = cidades.length
        ? await filtros.siglasDasCidades(ctx.empresaId, cidades.map(cidadeNormalizada))
        : [];
      const pedidas = new Set([
        ...unidades.filter((u) => !UUID.test(u)).map(maiusculas),
        ...pelasCidades,
      ]);
      siglas = siglas.filter((s) => pedidas.has(s));
    }
    const filiais = naoVazia(entrada.filiais?.map(maiusculas));
    if (filiais) siglas = siglas.filter((s) => filiais.includes(s));
    if (siglas.length === 0) return [];

    return filtros.pagadores(ctx.empresaId, {
      periodo: {
        campo: entrada.campoData,
        inicio: entrada.inicio ?? null,
        fim: entrada.fim ?? null,
      },
      siglas,
      limite: PAGADORES,
    });
  });
}

/**
 * Tipos de documento da base inteira. Falha → vazio (o filtro fica sem opções, a tela segue).
 * origem: getTiposDocumentoOpcoes, tipos_documento_opcoes (sistema atual)
 */
export async function listarTiposDocumento(
  db: Db,
  ctx: ContextoFiltros,
): Promise<TipoDocumentoOpcao[]> {
  return db(({ filtros }) => filtros.tiposDocumento(ctx.empresaId)).catch(() => []);
}

/**
 * Quantos CT-e de cada tipo há no período da tela. Falha → nulo (o seletor mostra todos).
 * origem: getTiposDocumentoNoPeriodo, tipos_documento_no_periodo (sistema atual)
 */
export async function listarTiposDocumentoNoPeriodo(
  db: Db,
  ctx: ContextoFiltros,
  entrada: { inicio: string; fim: string; campoData: CampoDataTipoDocumento },
): Promise<TipoDocumentoOpcao[] | null> {
  return db(({ filtros }) =>
    filtros.tiposDocumentoNoPeriodo(
      ctx.empresaId,
      entrada.inicio,
      entrada.fim,
      entrada.campoData,
      ctx.fuso,
    ),
  ).catch(() => null);
}
