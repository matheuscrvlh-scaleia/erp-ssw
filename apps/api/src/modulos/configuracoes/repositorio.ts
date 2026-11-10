import { type Transacao } from "@erp/db";
import { configuracoes } from "@erp/db/schema";
import { and, eq, inArray } from "drizzle-orm";

import { type RepositorioConfiguracoes } from "./casos-de-uso";

export function criarRepositorioConfiguracoes(tx: Transacao): RepositorioConfiguracoes {
  return {
    daEmpresa: (empresaId, grupos) =>
      tx
        .select({
          chave: configuracoes.chave,
          valor: configuracoes.valor,
          descricao: configuracoes.descricao,
          grupo: configuracoes.grupo,
          atualizadoEm: configuracoes.atualizadoEm,
        })
        .from(configuracoes)
        .where(
          and(eq(configuracoes.empresaId, empresaId), inArray(configuracoes.grupo, [...grupos])),
        ),

    valores: async (empresaId, chaves) => {
      const linhas = await tx
        .select({ chave: configuracoes.chave, valor: configuracoes.valor })
        .from(configuracoes)
        .where(
          and(eq(configuracoes.empresaId, empresaId), inArray(configuracoes.chave, [...chaves])),
        );
      return new Map(linhas.map((l) => [l.chave, l.valor]));
    },

    gravarValor: async (empresaId, chave, valor, atualizadoPor) => {
      await tx
        .update(configuracoes)
        .set({ valor, atualizadoPor, atualizadoEm: new Date() })
        .where(and(eq(configuracoes.empresaId, empresaId), eq(configuracoes.chave, chave)));
    },
  };
}
