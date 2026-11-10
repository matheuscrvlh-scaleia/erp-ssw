import { type Transacao } from "@erp/db";
import { empresaIntegracoes, empresas } from "@erp/db/schema";
import { and, eq } from "drizzle-orm";

import { type RepositorioAhgora } from "./casos-de-uso";

export function criarRepositorioAhgora(tx: Transacao): RepositorioAhgora {
  return {
    integracao: async (empresaId) => {
      const [linha] = await tx
        .select({
          empresaNome: empresas.nome,
          empresaStatus: empresas.status,
          ativo: empresaIntegracoes.ativo,
          parametros: empresaIntegracoes.parametros,
          segredoCifrado: empresaIntegracoes.segredoCifrado,
          segredoVersaoChave: empresaIntegracoes.segredoVersaoChave,
        })
        .from(empresas)
        .leftJoin(
          empresaIntegracoes,
          and(eq(empresaIntegracoes.empresaId, empresas.id), eq(empresaIntegracoes.tipo, "ahgora")),
        )
        .where(eq(empresas.id, empresaId));
      if (!linha) return null;
      return {
        empresaNome: linha.empresaNome,
        empresaStatus: linha.empresaStatus,
        ativo: linha.ativo,
        parametros: linha.parametros ?? {},
        segredo:
          linha.segredoCifrado !== null && linha.segredoVersaoChave !== null
            ? { cifrado: linha.segredoCifrado, versaoChave: linha.segredoVersaoChave }
            : null,
      };
    },
  };
}
