import { type Transacao } from "@erp/db";
import { empresaIntegracoes, empresas } from "@erp/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

import { type RepositorioAgendamentos } from "./agendamentos";

export function criarRepositorioAgendamentos(tx: Transacao): RepositorioAgendamentos {
  return {
    empresasAtivas: () =>
      tx
        .select({
          id: empresas.id,
          fuso: empresas.fuso,
          integracoesAtivas: sql<
            string[]
          >`coalesce(array_agg(${empresaIntegracoes.tipo}) filter (where ${empresaIntegracoes.tipo} is not null), '{}')`,
        })
        .from(empresas)
        .leftJoin(
          empresaIntegracoes,
          and(eq(empresaIntegracoes.empresaId, empresas.id), eq(empresaIntegracoes.ativo, true)),
        )
        .where(inArray(empresas.status, ["ativa", "implantacao"]))
        .groupBy(empresas.id, empresas.fuso),
  };
}
