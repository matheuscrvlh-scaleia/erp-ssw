import { type Transacao } from "@erp/db";
import { codigosOcorrencia, ctes, ocorrencias } from "@erp/db/schema";
import { comoCte } from "@erp/ingestao/infra";
import { and, asc, eq, exists, gt, inArray, or, sql } from "drizzle-orm";

import { type RepositorioRecalculo } from "./job";

export function criarRepositorioRecalculo(tx: Transacao): RepositorioRecalculo {
  return {
    propagarClassificacao: async (empresaId, codigo, limite) => {
      const divergem = and(
        eq(codigosOcorrencia.empresaId, ocorrencias.empresaId),
        eq(codigosOcorrencia.codigo, ocorrencias.codigo),
        or(
          sql`${ocorrencias.penaliza} is distinct from ${codigosOcorrencia.penaliza}`,
          sql`${ocorrencias.responsavel} is distinct from ${codigosOcorrencia.responsavel}`,
        ),
      );
      const lote = tx
        .select({ id: ocorrencias.id })
        .from(ocorrencias)
        .innerJoin(codigosOcorrencia, divergem)
        .where(and(eq(ocorrencias.empresaId, empresaId), eq(ocorrencias.codigo, codigo)))
        .limit(limite);
      const resultado = await tx
        .update(ocorrencias)
        .set({
          penaliza: sql`${codigosOcorrencia.penaliza}`,
          responsavel: sql`${codigosOcorrencia.responsavel}`,
        })
        .from(codigosOcorrencia)
        .where(and(inArray(ocorrencias.id, lote), divergem));
      return resultado.rowCount ?? 0;
    },

    ctesDoCodigo: async (empresaId, codigo, aposId, limite) => {
      const temOcorrencia = tx
        .select({ um: sql`1` })
        .from(ocorrencias)
        .where(
          and(
            eq(ocorrencias.empresaId, empresaId),
            eq(ocorrencias.cteId, ctes.id),
            eq(ocorrencias.codigo, codigo),
          ),
        );
      const linhas = await tx
        .select()
        .from(ctes)
        .where(
          and(
            eq(ctes.empresaId, empresaId),
            aposId ? gt(ctes.id, aposId) : undefined,
            or(eq(ctes.ocorrEfetivaCodigoNum, codigo), exists(temOcorrencia)),
          ),
        )
        .orderBy(asc(ctes.id))
        .limit(limite);
      return linhas.map(comoCte);
    },
  };
}
