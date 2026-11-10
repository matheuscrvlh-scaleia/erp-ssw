import { type Transacao } from "@erp/db";
import { empresaIntegracoes, empresas } from "@erp/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";

import { type RepositorioAgendamentos } from "./agendamentos";

export function criarRepositorioAgendamentos(tx: Transacao): RepositorioAgendamentos {
  return {
    empresasAtivas: () =>
      tx
        .select({ id: empresas.id, fuso: empresas.fuso })
        .from(empresas)
        .where(inArray(empresas.status, ["ativa", "implantacao"])),
    empresasComIntegracao: (tipo) =>
      tx
        .select({ id: empresas.id })
        .from(empresas)
        .innerJoin(empresaIntegracoes, eq(empresaIntegracoes.empresaId, empresas.id))
        .where(
          and(
            inArray(empresas.status, ["ativa", "implantacao"]),
            eq(empresaIntegracoes.tipo, tipo),
            eq(empresaIntegracoes.ativo, true),
          ),
        )
        .orderBy(asc(empresas.criadoEm), asc(empresas.id)),
  };
}
