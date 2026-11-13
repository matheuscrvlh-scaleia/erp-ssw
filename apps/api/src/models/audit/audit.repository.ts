import { sql, type Transacao } from "@erp/db";

import { type RepositorioAuditoria } from "./audit.service";

export function criarRepositorioAuditoria(tx: Transacao): RepositorioAuditoria {
  return {
    registrar: async (ator, evento) => {
      await tx.executar(sql`
        insert into erp.auditoria (empresa_id, ator_id, ator_email, ator_tipo, acao, entidade,
                                   entidade_id, resumo, antes, depois, ip, user_agent)
        values (${evento.empresaId}, ${ator.usuarioId}, ${ator.email},
                ${ator.plataforma ? "plataforma" : "usuario"}, ${evento.acao}, ${evento.entidade},
                ${evento.entidadeId}, ${evento.resumo}, ${sql.json(evento.antes)},
                ${sql.json(evento.depois)}, ${ator.ip}, ${ator.userAgent})`);
    },
  };
}
