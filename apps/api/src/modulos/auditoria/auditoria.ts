/** Quem fez a ação, como a requisição o identifica. Vai para cada linha de auditoria. */
export interface Ator {
  usuarioId: string;
  email: string;
  plataforma: boolean;
  ip: string | null;
  userAgent: string | null;
}

export interface EventoDeAuditoria {
  empresaId: string | null;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  resumo: string | null;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
}

export interface RepositorioAuditoria {
  registrar(ator: Ator, evento: EventoDeAuditoria): Promise<void>;
}
