import { type Transacao } from "@erp/db";
import { ctePrazoHistorico, ctes, ocorrencias, prazosConfigurados } from "@erp/db/schema";
import { CODIGO_CHEGADA_NA_UNIDADE, type OcorrenciaDoCte } from "@erp/dominio/nucleo";
import { and, asc, eq, gt, inArray, or, type SQL } from "drizzle-orm";

import { FONTES_DE_REGRA, type RepositorioPrazosDoJob } from "./recalculo-de-prazos.service";

export function criarRepositorioPrazosDoJob(tx: Transacao): RepositorioPrazosDoJob {
  return {
    regras: (empresaId) =>
      tx
        .select({
          id: prazosConfigurados.id,
          tipo: prazosConfigurados.tipo,
          unidadeCodigo: prazosConfigurados.unidadeCodigo,
          unidadeDestinoCodigo: prazosConfigurados.unidadeDestinoCodigo,
          parceiroCnpj: prazosConfigurados.parceiroCnpj,
          prazoHoras: prazosConfigurados.prazoHoras,
          prazoDias: prazosConfigurados.prazoDias,
          ativo: prazosConfigurados.ativo,
          criadoEm: prazosConfigurados.criadoEm,
        })
        .from(prazosConfigurados)
        .where(eq(prazosConfigurados.empresaId, empresaId)),

    candidatos: (empresaId, filtro, aposId, limite) => {
      const alcance: SQL[] = [inArray(ctes.prazoFonte, FONTES_DE_REGRA)];
      if (filtro.parceiros.length > 0) alcance.push(inArray(ctes.parceiroCnpj, filtro.parceiros));
      if (filtro.filiais.length > 0) alcance.push(inArray(ctes.filial, filtro.filiais));
      return tx
        .select({
          id: ctes.id,
          parceiroCnpj: ctes.parceiroCnpj,
          filial: ctes.filial,
          dataEmissao: ctes.dataEmissao,
          dataPrevistaEntrega: ctes.dataPrevistaEntrega,
          prazoFonte: ctes.prazoFonte,
          dataBasePrazo: ctes.dataBasePrazo,
          previsaoSswData: ctes.previsaoSswData,
          previsaoSswFonte: ctes.previsaoSswFonte,
          previsaoSswDataBase: ctes.previsaoSswDataBase,
        })
        .from(ctes)
        .where(
          and(
            eq(ctes.empresaId, empresaId),
            aposId ? gt(ctes.id, aposId) : undefined,
            or(...alcance),
          ),
        )
        .orderBy(asc(ctes.id))
        .limit(limite);
    },

    chegadas: async (empresaId, cteIds) => {
      const porCte = new Map<string, OcorrenciaDoCte[]>();
      if (cteIds.length === 0) return porCte;
      const linhas = await tx
        .select({
          cteId: ocorrencias.cteId,
          id: ocorrencias.id,
          codigo: ocorrencias.codigo,
          descricao: ocorrencias.descricao,
          dataHora: ocorrencias.dataHora,
          filial: ocorrencias.filial,
          origem: ocorrencias.origem,
          quarentena: ocorrencias.quarentena,
          criadoEm: ocorrencias.criadoEm,
        })
        .from(ocorrencias)
        .where(
          and(
            eq(ocorrencias.empresaId, empresaId),
            eq(ocorrencias.codigo, CODIGO_CHEGADA_NA_UNIDADE),
            inArray(ocorrencias.cteId, cteIds),
          ),
        );
      for (const { cteId, ...ocorrencia } of linhas) {
        porCte.set(cteId, [...(porCte.get(cteId) ?? []), ocorrencia]);
      }
      return porCte;
    },

    gravar: async (empresaId, novas) => {
      for (const n of novas) {
        await tx
          .update(ctes)
          .set({
            dataPrevistaEntrega: n.dataPrevistaEntrega,
            prazoFonte: n.prazoFonte,
            dataBasePrazo: n.dataBasePrazo,
            previsaoSswData: n.previsaoSswData,
            previsaoSswFonte: n.previsaoSswFonte,
            previsaoSswDataBase: n.previsaoSswDataBase,
            atualizadoEm: new Date(),
          })
          .where(and(eq(ctes.empresaId, empresaId), eq(ctes.id, n.cteId)));
      }
      const historico = novas.flatMap((n) => (n.troca ? [{ cteId: n.cteId, ...n.troca }] : []));
      if (historico.length === 0) return;
      await tx.insert(ctePrazoHistorico).values(historico.map((h) => ({ empresaId, ...h })));
    },
  };
}
