import { sql, type Transacao } from "@erp/db";
import { STATUS_EM_OPERACAO } from "@erp/domain/companies";

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
      tx.consultar<EmpresaAgendavel>(sql`
        select id, fuso from erp.empresas where status = any(${[...STATUS_EM_OPERACAO]})`),
  };
}
