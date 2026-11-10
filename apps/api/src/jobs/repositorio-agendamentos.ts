import { type Transacao } from "@erp/db";
import { empresas } from "@erp/db/schema";
import { STATUS_EM_OPERACAO } from "@erp/dominio/empresas";
import { inArray } from "drizzle-orm";

import { type RepositorioAgendamentos } from "./agendamentos";

export function criarRepositorioAgendamentos(tx: Transacao): RepositorioAgendamentos {
  return {
    empresasAtivas: () =>
      tx
        .select({ id: empresas.id, fuso: empresas.fuso })
        .from(empresas)
        .where(inArray(empresas.status, [...STATUS_EM_OPERACAO])),
  };
}
