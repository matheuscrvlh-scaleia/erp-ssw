import { type Transacao } from "@erp/db";
import { configuracoes } from "@erp/db/schema";
import { and, eq, inArray } from "drizzle-orm";

import { type RepositorioConfiguracoes } from "./configuracoes.service";
import { type LeitorDeConfiguracoes } from "./leitor";

export function criarRepositorioConfiguracoes(
  tx: Transacao,
  configuracoesVigentes: LeitorDeConfiguracoes,
): RepositorioConfiguracoes {
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

    vigentes: configuracoesVigentes,

    gravarValor: async (empresaId, chave, valor, atualizadoPor) => {
      await tx
        .update(configuracoes)
        .set({ valor, atualizadoPor, atualizadoEm: new Date() })
        .where(and(eq(configuracoes.empresaId, empresaId), eq(configuracoes.chave, chave)));
    },
  };
}
