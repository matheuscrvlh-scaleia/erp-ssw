import { type Card, type CodigoDoCard } from "@erp/shared/contratos/ocorrencias";

import { agrupar } from "../colecoes";
import { classificar, type CodigoDoCatalogo } from "./catalogo";
import { ctesPenalizantes } from "./painel";

export interface OcorrenciaDoCard {
  cteId: string;
  codigo: number;
  descricao: string | null;
  cteEmAtraso: boolean;
}

/**
 * Códigos por trás de um card ("ver códigos"), só com os filtros de CT-e. "Penalizantes" traz
 * todos os códigos dos CT-e penalizantes, inclusive os que não penalizam.
 * origem: ocorrencias_codigos_bucket_v3 (sistema atual)
 */
export function codigosDoCard(
  ocorrencias: readonly OcorrenciaDoCard[],
  catalogo: ReadonlyMap<number, CodigoDoCatalogo>,
  card: Card,
): CodigoDoCard[] {
  const classificadas = ocorrencias.map((o) => ({
    ...o,
    classificacao: classificar(o.codigo, o.descricao, catalogo.get(o.codigo)),
  }));
  const emAtraso = new Map(classificadas.map((o) => [o.cteId, o.cteEmAtraso]));
  const penalizantes = ctesPenalizantes(classificadas, (id) => emAtraso.get(id) ?? false);
  const doCard = classificadas.filter((o) => {
    switch (card) {
      case "todas":
        return true;
      case "pendentes":
        return o.classificacao.pendente;
      case "penalizantes":
        return penalizantes.has(o.cteId);
      case "externas":
        return !penalizantes.has(o.cteId);
    }
  });
  return [...agrupar(doCard, (o) => o.codigo).values()]
    .map((doCodigo) => {
      const { codigo, classificacao } = doCodigo[0]!;
      return {
        codigo,
        descricao: classificacao.descricao,
        responsavel: classificacao.responsavel,
        penaliza: doCodigo.some((o) => o.classificacao.penaliza),
        pendente: doCodigo.some((o) => o.classificacao.pendente),
        total: doCodigo.length,
        ctrcs: new Set(doCodigo.map((o) => o.cteId)).size,
      };
    })
    .sort((a, b) => b.total - a.total || a.codigo - b.codigo);
}
