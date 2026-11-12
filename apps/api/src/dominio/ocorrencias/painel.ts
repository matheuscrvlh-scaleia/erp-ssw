import {
  type FaixaAtraso,
  FAIXAS_ATRASO,
  type PainelDeOcorrencias,
  type Recortes,
  type Responsabilidade,
  type ResponsavelDoEvento,
} from "@erp/shared/contratos/ocorrencias";

import { agrupar, type Grupo } from "../colecoes";
import { compararTexto } from "../ordem";
import {
  type Classificacao,
  classificar,
  type CodigoDoCatalogo,
  pesaContraAOperacao,
} from "./catalogo";
import { estaNoPeriodo, type Periodo } from "./periodo";
import { faixaDoAtraso, type Situacao } from "./situacao";

/** CT-e já com os filtros de CT-e aplicados, com o que o painel precisa. */
export interface CteDoPainel {
  id: string;
  /** Emissão ou previsão, conforme o campo de data escolhido. */
  dataBase: string;
  pagador: string;
  unidadeResp: string | null;
  noPrazo: boolean | null;
  situacao: Situacao;
}

/** Ocorrência de um código da tela, de um CT-e do universo. */
export interface OcorrenciaDoPainel {
  cteId: string;
  codigo: number;
  descricao: string | null;
}

type RecortesDeCte = Pick<Recortes, "pagador" | "unidadeResp" | "prazo" | "faixaAtraso">;

/**
 * Recortes que olham só o CT-e (cards de prazo e faixa, blocos de pagador e unidade).
 * origem: filtros p_pagador_nome/p_unidade_resp/p_prazo/p_faixa_atraso de ocorrencias_painel_v5
 */
export function casaRecortesDeCte(cte: CteDoPainel, r: RecortesDeCte): boolean {
  if (r.pagador !== null && cte.pagador !== r.pagador) return false;
  if (r.unidadeResp !== null && (cte.unidadeResp ?? "—") !== r.unidadeResp) return false;
  if (r.prazo === "no_prazo" && cte.noPrazo !== true) return false;
  if (r.prazo === "fora_prazo" && cte.noPrazo !== false) return false;
  if (r.prazo === "sem_prazo" && cte.noPrazo !== null) return false;
  if (r.faixaAtraso !== null && faixaDoAtraso(cte.situacao.atrasoDias) !== r.faixaAtraso) {
    return false;
  }
  return true;
}

/**
 * CT-e "penalizante": alguma ocorrência da tela pesa contra a operação (sem olhar os filtros de
 * código e responsável) e ele está em atraso. Decisão de 21/08/2026.
 */
export function ctesPenalizantes(
  eventos: readonly { cteId: string; classificacao: Classificacao }[],
  emAtraso: (cteId: string) => boolean,
): Set<string> {
  const comPeso = new Set(
    eventos.filter((e) => pesaContraAOperacao(e.classificacao)).map((e) => e.cteId),
  );
  return new Set([...comPeso].filter(emAtraso));
}

/** Aba de responsabilidade: "pendentes" é por evento; "penalizantes"/"externas", por CT-e. */
export function casaResponsabilidade(
  aba: Responsabilidade,
  pendente: boolean,
  penalizante: boolean,
): boolean {
  switch (aba) {
    case "todas":
      return true;
    case "pendentes":
      return pendente;
    case "penalizantes":
      return penalizante;
    case "externas":
      return !penalizante;
  }
}

export function casaCodigoEResponsavel(
  codigo: number,
  responsavel: ResponsavelDoEvento,
  r: Pick<Recortes, "codigos" | "responsaveis">,
): boolean {
  return (
    (r.codigos.length === 0 || r.codigos.includes(codigo)) &&
    (r.responsaveis.length === 0 || (r.responsaveis as readonly string[]).includes(responsavel))
  );
}

interface EntradaDoPainel {
  /** CT-e dos dois períodos, já com os filtros de CT-e. */
  ctes: readonly CteDoPainel[];
  /** Ocorrências dos códigos da tela desses CT-e. */
  ocorrencias: readonly OcorrenciaDoPainel[];
  catalogo: ReadonlyMap<number, CodigoDoCatalogo>;
  atual: Periodo;
  anterior: Periodo;
  recortes: Recortes;
  codigosAcompanhados: number;
}

interface Evento {
  cte: CteDoPainel;
  codigo: number;
  classificacao: Classificacao;
  penalizante: boolean;
  /** Cards: período atual com código e responsável, sem a aba. */
  card: boolean;
  /** Demais blocos: com a aba. */
  bloco: boolean;
  blocoAnterior: boolean;
  /** Impacto: sem o filtro de código. */
  impacto: boolean;
  impactoAnterior: boolean;
}

const distintos = (eventos: readonly Evento[]) => new Set(eventos.map((e) => e.cte.id)).size;

function marcarEventos(entrada: EntradaDoPainel): { universo: CteDoPainel[]; eventos: Evento[] } {
  const { atual, anterior, recortes: r } = entrada;
  const universo = entrada.ctes.filter((c) => casaRecortesDeCte(c, r));
  const porId = new Map(universo.map((c) => [c.id, c]));
  const brutos = entrada.ocorrencias.flatMap((o) => {
    const cte = porId.get(o.cteId);
    return cte
      ? [
          {
            cte,
            cteId: cte.id,
            codigo: o.codigo,
            classificacao: classificar(o.codigo, o.descricao, entrada.catalogo.get(o.codigo)),
          },
        ]
      : [];
  });
  const penalizantes = ctesPenalizantes(brutos, (id) => porId.get(id)?.situacao.emAtraso ?? false);
  const eventos = brutos.map((b): Evento => {
    const penalizante = penalizantes.has(b.cteId);
    const noAtual = estaNoPeriodo(b.cte.dataBase, atual);
    const noAnterior = estaNoPeriodo(b.cte.dataBase, anterior);
    const okResponsavel =
      r.responsaveis.length === 0 ||
      (r.responsaveis as readonly string[]).includes(b.classificacao.responsavel);
    const okCodigo = r.codigos.length === 0 || r.codigos.includes(b.codigo);
    const okAba = casaResponsabilidade(r.responsabilidade, b.classificacao.pendente, penalizante);
    return {
      cte: b.cte,
      codigo: b.codigo,
      classificacao: b.classificacao,
      penalizante,
      card: noAtual && okCodigo && okResponsavel,
      bloco: noAtual && okCodigo && okResponsavel && okAba,
      blocoAnterior: noAnterior && okCodigo && okResponsavel && okAba,
      impacto: noAtual && okResponsavel && okAba,
      impactoAnterior: noAnterior && okResponsavel && okAba,
    };
  });
  return { universo, eventos };
}

function contarFaixas(eventos: readonly Evento[]): Record<FaixaAtraso, number> {
  const faixas = Object.fromEntries(FAIXAS_ATRASO.map((f) => [f, new Set<string>()])) as Record<
    FaixaAtraso,
    Set<string>
  >;
  for (const e of eventos) {
    const faixa = faixaDoAtraso(e.cte.situacao.atrasoDias);
    if (faixa) faixas[faixa].add(e.cte.id);
  }
  return Object.fromEntries(FAIXAS_ATRASO.map((f) => [f, faixas[f].size])) as Record<
    FaixaAtraso,
    number
  >;
}

/** Descrição, responsável e flags de um código (iguais em todos os eventos dele). */
function resumoDoCodigo(eventos: Grupo<Evento>) {
  const [primeiro] = eventos;
  return {
    codigo: primeiro.codigo,
    descricao: primeiro.classificacao.descricao,
    responsavel: primeiro.classificacao.responsavel,
    penaliza: eventos.some((e) => e.classificacao.penaliza),
    pendente: eventos.some((e) => e.classificacao.pendente),
  };
}

/**
 * Painel da tela Ocorrências: cards, prazo, faixas, finalização, pagadores, códigos mais
 * frequentes (com o mês anterior), onde atuar e impacto por código.
 * origem: ocorrencias_painel_v5 (sistema atual)
 */
export function calcularPainel(
  entrada: EntradaDoPainel,
): Omit<PainelDeOcorrencias, "periodoAnterior" | "codigosAcompanhados"> {
  const { universo, eventos } = marcarEventos(entrada);
  const cards = eventos.filter((e) => e.card);
  const blocos = eventos.filter((e) => e.bloco);
  const ctesDosBlocos = [...new Map(blocos.map((e) => [e.cte.id, e.cte])).values()];
  const contarCtes = (filtro: (c: CteDoPainel) => boolean) => ctesDosBlocos.filter(filtro).length;

  const topCodigos = [...agrupar(eventos, (e) => e.codigo).values()]
    .map((doCodigo) => {
      const count = doCodigo.filter((e) => e.bloco).length;
      const countAnterior = doCodigo.filter((e) => e.blocoAnterior).length;
      return { ...resumoDoCodigo(doCodigo), count, countAnterior, delta: count - countAnterior };
    })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count || a.codigo - b.codigo)
    .slice(0, 10);

  const porPagador = [...agrupar(blocos, (e) => e.cte.pagador)]
    .map(([pagador, doPagador]) => ({ pagador, ctrcs: distintos(doPagador) }))
    .sort((a, b) => b.ctrcs - a.ctrcs || compararTexto(a.pagador, b.pagador))
    .slice(0, 15);

  const ondeAtuar = [...agrupar(blocos, (e) => e.cte.unidadeResp ?? "—")]
    .map(([unidade, daUnidade]) => ({
      unidade,
      ocorrencias: daUnidade.length,
      // Por evento: a ocorrência que pesa contra a operação num CT-e em atraso.
      penalizantes: daUnidade.filter(
        (e) => pesaContraAOperacao(e.classificacao) && e.cte.situacao.emAtraso,
      ).length,
      pendentes: daUnidade.filter((e) => e.classificacao.pendente).length,
      ctrcs: distintos(daUnidade),
    }))
    .sort(
      (a, b) =>
        b.penalizantes - a.penalizantes ||
        b.ocorrencias - a.ocorrencias ||
        compararTexto(a.unidade, b.unidade),
    );

  const impactoLinhas = [...agrupar(eventos, (e) => e.codigo).values()]
    .map((doCodigo) => {
      const { codigo, descricao, penaliza } = resumoDoCodigo(doCodigo);
      return {
        codigo,
        descricao,
        penaliza,
        ocorrencias: doCodigo.filter((e) => e.impacto).length,
        ocorrenciasAnterior: doCodigo.filter((e) => e.impactoAnterior).length,
      };
    })
    .filter((l) => l.ocorrencias + l.ocorrenciasAnterior > 0)
    .sort(
      (a, b) =>
        b.ocorrencias - a.ocorrencias ||
        b.ocorrenciasAnterior - a.ocorrenciasAnterior ||
        a.codigo - b.codigo,
    );

  const ctrcs = distintos(cards);
  const penalizantes = distintos(cards.filter((e) => e.penalizante));
  return {
    metricas: {
      total: cards.length,
      pendentes: cards.filter((e) => e.classificacao.pendente).length,
      ctrcs,
      penalizantes,
      naoPenalizantes: ctrcs - penalizantes,
    },
    prazo: {
      noPrazo: contarCtes((c) => c.noPrazo === true),
      foraPrazo: contarCtes((c) => c.noPrazo === false),
      semPrazo: contarCtes((c) => c.noPrazo === null),
    },
    faixasAtraso: contarFaixas(blocos),
    finalizacao: {
      ctrcs: ctesDosBlocos.length,
      entregues: contarCtes((c) => c.situacao.entregue),
      baixados: contarCtes((c) => c.situacao.baixado),
      emAberto: contarCtes((c) => c.situacao.emAberto),
      emAtraso: contarCtes((c) => c.situacao.emAtraso),
    },
    porPagador,
    topCodigos,
    ondeAtuar,
    impacto: {
      ctrcs: universo.filter((c) => estaNoPeriodo(c.dataBase, entrada.atual)).length,
      ctrcsAnterior: universo.filter((c) => estaNoPeriodo(c.dataBase, entrada.anterior)).length,
      linhas: impactoLinhas,
    },
  };
}
