import { type OrdemDaLista, type Recortes } from "@erp/shared/contratos/ocorrencias";

import {
  compararComNulosNoFim,
  compararNumero,
  compararNumeroEmTexto,
  compararTexto,
} from "../ordem";
import { type Classificacao, classificar, type CodigoDoCatalogo } from "./catalogo";
import {
  casaCodigoEResponsavel,
  casaRecortesDeCte,
  casaResponsabilidade,
  type CteDoPainel,
  ctesPenalizantes,
} from "./painel";

/** Ocorrência do período atual com o CT-e dela (já com os filtros de CT-e). */
export interface OcorrenciaDaLista {
  id: string;
  dataHora: Date;
  codigo: number;
  descricao: string | null;
  cte: CteDoPainel & {
    numero: string;
    /** `parceiros.nome` ou o expedidor do CT-e: só chave da ordenação "Parceiro". */
    parceiroNome: string | null;
  };
}

export interface LinhaClassificada extends OcorrenciaDaLista {
  classificacao: Classificacao;
}

export interface PedidoDaLista {
  recortes: Recortes;
  ordem: OrdemDaLista;
  direcao: "asc" | "desc";
  pagina: number;
  tamanho: number;
}

/** Até o segundo: eventos no mesmo segundo desempatam pelo id (igual ao sistema atual). */
const segundo = (d: Date) => Math.floor(d.getTime() / 1000);

type Direcao = "asc" | "desc";
type Comparador = (a: LinhaClassificada, b: LinhaClassificada, direcao: Direcao) => number;

/**
 * Comparação de cada ordenação. Atraso e número do CT-e são comparados como número, e "sem
 * atraso" fica sempre no fim (Q06 do dono).
 */
const COMPARADORES: Record<OrdemDaLista, Comparador> = {
  data_hora: (a, b, d) =>
    compararComNulosNoFim(segundo(a.dataHora), segundo(b.dataHora), compararNumero, d),
  codigo: (a, b, d) => compararComNulosNoFim(a.codigo, b.codigo, compararNumero, d),
  responsavel: (a, b, d) =>
    compararComNulosNoFim(
      a.classificacao.responsavel,
      b.classificacao.responsavel,
      compararTexto,
      d,
    ),
  numero_ctrc: (a, b, d) =>
    compararComNulosNoFim(a.cte.numero, b.cte.numero, compararNumeroEmTexto, d),
  parceiro_nome: (a, b, d) =>
    compararComNulosNoFim(a.cte.parceiroNome, b.cte.parceiroNome, compararTexto, d),
  atraso_dias: (a, b, d) =>
    compararComNulosNoFim(a.cte.situacao.atrasoDias, b.cte.situacao.atrasoDias, compararNumero, d),
};

export function ordenarLista(
  linhas: readonly LinhaClassificada[],
  ordem: OrdemDaLista,
  direcao: Direcao,
): LinhaClassificada[] {
  const comparar = COMPARADORES[ordem];
  return [...linhas].sort(
    (a, b) => comparar(a, b, direcao) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/**
 * Lista detalhada: ocorrências do período atual com recortes, código, responsável e aba,
 * ordenada e paginada. O total é o da lista inteira, mesmo numa página depois da última (Q10).
 * origem: ocorrencias_lista_v5 (sistema atual)
 */
export function montarLista(
  ocorrencias: readonly OcorrenciaDaLista[],
  catalogo: ReadonlyMap<number, CodigoDoCatalogo>,
  pedido: PedidoDaLista,
): { linhas: LinhaClassificada[]; total: number } {
  const r = pedido.recortes;
  const classificadas = ocorrencias.map((o) => ({
    ...o,
    cteId: o.cte.id,
    classificacao: classificar(o.codigo, o.descricao, catalogo.get(o.codigo)),
  }));
  // Penalizante olha todas as ocorrências da tela do CT-e, antes dos filtros de código.
  const emAtraso = new Map(classificadas.map((o) => [o.cte.id, o.cte.situacao.emAtraso]));
  const penalizantes = ctesPenalizantes(classificadas, (id) => emAtraso.get(id) ?? false);
  const filtradas = classificadas.filter(
    (o) =>
      casaRecortesDeCte(o.cte, r) &&
      casaCodigoEResponsavel(o.codigo, o.classificacao.responsavel, r) &&
      casaResponsabilidade(
        r.responsabilidade,
        o.classificacao.pendente,
        penalizantes.has(o.cte.id),
      ),
  );
  const inicio = (pedido.pagina - 1) * pedido.tamanho;
  return {
    linhas: ordenarLista(filtradas, pedido.ordem, pedido.direcao).slice(
      inicio,
      inicio + pedido.tamanho,
    ),
    total: filtradas.length,
  };
}
