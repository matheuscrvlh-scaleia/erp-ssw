import { type Transacao } from "@erp/db";
import {
  ctePrazoHistorico,
  ctes,
  fontesDePrazo,
  ocorrencias,
  prazosConfigurados,
} from "@erp/db/schema";
import { CODIGO_CHEGADA } from "@erp/dominio/prazos-configurados";
import { and, asc, eq, gt, inArray, min, or, type SQL } from "drizzle-orm";

import { type RepositorioPrazosDoWorker } from "./job";

/** A fonte vem do domínio como texto; só grava se for uma das conhecidas pelo banco. */
const fonteConhecida = (fonte: string | null) => fontesDePrazo.find((f) => f === fonte) ?? null;

export function criarRepositorioPrazosDoWorker(tx: Transacao): RepositorioPrazosDoWorker {
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
      const alcance: SQL[] = [
        inArray(
          ctes.prazoFonte,
          filtro.fontesDeRegra.flatMap((f) => {
            const conhecida = fonteConhecida(f);
            return conhecida ? [conhecida] : [];
          }),
        ),
      ];
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
          previsaoSsw: ctes.previsaoSsw,
          previsaoSswFonte: ctes.previsaoSswFonte,
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

    chegadas: async (empresaId, cteIds, filiais) => {
      const porCte = new Map<string, Map<string, Date>>();
      if (cteIds.length === 0 || filiais.length === 0) return porCte;
      const linhas = await tx
        .select({
          cteId: ocorrencias.cteId,
          filial: ocorrencias.filial,
          chegada: min(ocorrencias.dataHora),
        })
        .from(ocorrencias)
        .where(
          and(
            eq(ocorrencias.empresaId, empresaId),
            eq(ocorrencias.codigo, CODIGO_CHEGADA),
            inArray(ocorrencias.cteId, cteIds),
            inArray(ocorrencias.filial, filiais),
          ),
        )
        .groupBy(ocorrencias.cteId, ocorrencias.filial);
      for (const { cteId, filial, chegada } of linhas) {
        if (!filial || !chegada) continue;
        const doCte = porCte.get(cteId) ?? new Map<string, Date>();
        doCte.set(filial, chegada);
        porCte.set(cteId, doCte);
      }
      return porCte;
    },

    gravar: async (empresaId, novas) => {
      for (const n of novas) {
        await tx
          .update(ctes)
          .set({
            dataPrevistaEntrega: n.previsao,
            prazoFonte: fonteConhecida(n.fonte),
            dataBasePrazo: n.dataBase,
            atualizadoEm: new Date(),
          })
          .where(and(eq(ctes.empresaId, empresaId), eq(ctes.id, n.cteId)));
      }
      const historico = novas.filter((n) => n.anterior !== null && n.anterior !== n.previsao);
      if (historico.length === 0) return;
      await tx.insert(ctePrazoHistorico).values(
        historico.map((n) => ({
          empresaId,
          cteId: n.cteId,
          dataAnterior: n.anterior,
          dataNova: n.previsao,
          fonte: n.fonte,
        })),
      );
    },
  };
}
