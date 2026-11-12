import { type Transacao } from "@erp/db";
import { empresas } from "@erp/db/schema";
import { STATUS_EM_OPERACAO } from "@erp/dominio/empresas";
import { inArray } from "drizzle-orm";

export interface EmpresaAgendavel {
  id: string;
  fuso: string;
}

export interface RepositorioAgendamentos {
  /** Empresas que recebem agendamento por empresa (ativas ou em implantação). */
  empresasAtivas(): Promise<EmpresaAgendavel[]>;
}

export function criarRepositorioAgendamentos(tx: Transacao): RepositorioAgendamentos {
  return {
    empresasAtivas: () =>
      tx
        .select({ id: empresas.id, fuso: empresas.fuso })
        .from(empresas)
        .where(inArray(empresas.status, [...STATUS_EM_OPERACAO])),
  };
}
