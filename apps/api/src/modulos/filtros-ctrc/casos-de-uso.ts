import { btrim, padroesTextoFiltro, somenteDigitos } from "@erp/dominio/nucleo/texto";
import { codigosDoFiltro, ehUuid } from "@erp/dominio/performance/filtro";
import { compararTexto } from "@erp/dominio/performance/primitivas";
import { type SaidaDe } from "@erp/shared/contrato";
import {
  type CampoDeSugestao,
  type contratosFiltrosCtrc,
  type PagadorOpcao,
} from "@erp/shared/contratos/filtros-ctrc";
import { type ContagemTipo } from "@erp/shared/contratos/performance";
import { type z } from "@erp/shared/zod";

import { type Executor } from "../../repositorios";

/** Filtros já normalizados para as consultas de opções (nulo = sem filtro). */
export interface FiltroDeOpcoes {
  periodo: { inicio: string; fim: string } | null;
  parceiros: string[] | null;
  remetente: string[] | null;
  destino: string[] | null;
  filiais: string[] | null;
  codigos: number[] | null;
}

export interface RepositorioFiltrosCtrc {
  filiaisProprias(empresaId: string): Promise<string[]>;
  codigosDoCatalogo(empresaId: string): Promise<{ codigo: number; descricao: string }[]>;
  /** Filiais efetivas distintas dos CT-e da empresa (sem universo, como hoje). */
  siglasComCtrc(empresaId: string, filtro: FiltroDeOpcoes): Promise<string[]>;
  sugestoes(
    empresaId: string,
    campo: CampoDeSugestao,
    padrao: string | null,
    filtro: FiltroDeOpcoes,
    limite: number,
  ): Promise<string[]>;
  /** Cidade de cada unidade (para achar a sigla pelo apelido da cidade). */
  cidadesDasUnidades(empresaId: string, ids: readonly string[]): Promise<string[]>;
  apelidosDeFiliais(empresaId: string): Promise<{ cidadeNormalizada: string; filial: string }[]>;
  pagadores(
    empresaId: string,
    filtro: {
      periodo: { inicio: string | null; fim: string | null };
      siglas: string[] | null;
      filiais: string[] | null;
      proprias: string[];
    },
    limite: number,
  ): Promise<PagadorOpcao[]>;
  tiposDocumento(empresaId: string): Promise<ContagemTipo[]>;
}

export interface ContextoFiltros {
  empresaId: string;
}

type Db = Executor<"filtrosCtrc">;
type C = typeof contratosFiltrosCtrc;

const LIMITE_DE_SUGESTOES = 20;

function texto(valor: string | null | undefined): string[] | null {
  return btrim(valor ?? "") ? padroesTextoFiltro(valor ?? "") : null;
}

const lista = (valores: readonly string[] | null | undefined) =>
  valores && valores.length > 0 ? [...valores] : null;

/** Maiúsculas e sem acento (a regra de `filial_alias`). origem: normalizar_nome (sistema atual) */
export function normalizarCidade(cidade: string): string {
  return cidade.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();
}

/**
 * Opções de "Unidade responsável": siglas com CT-e no período (só as próprias) e o catálogo de
 * códigos da empresa. origem: unidades_disponiveis_ctrcs + getFiliaisProprias (sistema atual)
 */
export async function listarUnidadesResponsaveis(
  db: Db,
  ctx: ContextoFiltros,
  entrada: z.output<C["unidadesResponsaveis"]["entrada"]>,
): Promise<SaidaDe<C["unidadesResponsaveis"]>> {
  return db(async ({ filtrosCtrc }) => {
    const proprias = new Set(await filtrosCtrc.filiaisProprias(ctx.empresaId));
    const siglas = await filtrosCtrc.siglasComCtrc(ctx.empresaId, {
      periodo: { inicio: entrada.inicio, fim: entrada.fim },
      parceiros: lista(entrada.parceiros?.map(somenteDigitos).filter(Boolean)),
      remetente: texto(entrada.remetente),
      destino: texto(entrada.destino),
      filiais: null,
      codigos: codigosDoFiltro(entrada.codigos),
    });
    return {
      siglas: siglas.filter((s) => proprias.has(s)).sort(compararTexto),
      codigos: await filtrosCtrc.codigosDoCatalogo(ctx.empresaId),
    };
  });
}

/**
 * Sugestões de remetente ou cidade de destino: o filtro do próprio campo é ignorado.
 * origem: sugestoes_texto_ctrcs (sistema atual)
 */
export async function sugerirTexto(
  db: Db,
  ctx: ContextoFiltros,
  entrada: z.output<C["sugestoesTexto"]["entrada"]>,
): Promise<string[]> {
  const q = entrada.q.trim();
  const periodo =
    entrada.inicio && entrada.fim ? { inicio: entrada.inicio, fim: entrada.fim } : null;
  return db(({ filtrosCtrc }) =>
    filtrosCtrc.sugestoes(
      ctx.empresaId,
      entrada.campo,
      q ? `%${q}%` : null,
      {
        periodo,
        parceiros: periodo ? lista(entrada.parceiros?.map(somenteDigitos).filter(Boolean)) : null,
        remetente: periodo && entrada.campo !== "remetente" ? texto(entrada.remetente) : null,
        destino: periodo && entrada.campo !== "cidade_destino" ? texto(entrada.destino) : null,
        filiais: periodo ? lista(entrada.filiais?.map((f) => f.trim().toUpperCase())) : null,
        codigos: periodo ? codigosDoFiltro(entrada.codigos) : null,
      },
      LIMITE_DE_SUGESTOES,
    ),
  );
}

/**
 * Pagadores do período (seletor Parceiros). `unidades`: sigla direta ou uuid da unidade, que vira
 * sigla pela cidade (apelido da filial). origem: listar_pagadores_ctrcs (sistema atual)
 */
export async function listarPagadores(
  db: Db,
  ctx: ContextoFiltros,
  entrada: z.output<C["pagadores"]["entrada"]>,
): Promise<PagadorOpcao[]> {
  return db(async ({ filtrosCtrc }) => {
    const unidades = entrada.unidades ?? [];
    let siglas: string[] | null = null;
    if (unidades.length > 0) {
      const diretas = unidades.filter((u) => !ehUuid(u)).map((u) => u.trim().toUpperCase());
      const ids = unidades.filter(ehUuid);
      const cidades =
        ids.length > 0 ? await filtrosCtrc.cidadesDasUnidades(ctx.empresaId, ids) : [];
      const apelidos = cidades.length > 0 ? await filtrosCtrc.apelidosDeFiliais(ctx.empresaId) : [];
      const normalizadas = new Set(cidades.map(normalizarCidade));
      siglas = [
        ...new Set([
          ...diretas,
          ...apelidos.filter((a) => normalizadas.has(a.cidadeNormalizada)).map((a) => a.filial),
        ]),
      ];
    }
    return filtrosCtrc.pagadores(
      ctx.empresaId,
      {
        periodo: { inicio: entrada.inicio ?? null, fim: entrada.fim ?? null },
        siglas,
        filiais: lista(entrada.filiais?.map((f) => f.trim().toUpperCase())),
        proprias: await filtrosCtrc.filiaisProprias(ctx.empresaId),
      },
      entrada.limite,
    );
  });
}

/** Tipos de documento de todos os CT-e da empresa (opções do seletor). origem: tipos_documento_opcoes */
export async function listarTiposDocumento(db: Db, ctx: ContextoFiltros): Promise<ContagemTipo[]> {
  return db(({ filtrosCtrc }) => filtrosCtrc.tiposDocumento(ctx.empresaId));
}
