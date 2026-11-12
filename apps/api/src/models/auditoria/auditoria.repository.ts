import { type Transacao } from "@erp/db";
import { auditoria } from "@erp/db/schema";

import { type RepositorioAuditoria } from "./auditoria.service";

export function criarRepositorioAuditoria(tx: Transacao): RepositorioAuditoria {
  return {
    registrar: async (ator, evento) => {
      await tx.insert(auditoria).values({
        empresaId: evento.empresaId,
        atorId: ator.usuarioId,
        atorEmail: ator.email,
        atorTipo: ator.plataforma ? "plataforma" : "usuario",
        acao: evento.acao,
        entidade: evento.entidade,
        entidadeId: evento.entidadeId,
        resumo: evento.resumo,
        antes: evento.antes,
        depois: evento.depois,
        ip: ator.ip,
        userAgent: ator.userAgent,
      });
    },
  };
}
