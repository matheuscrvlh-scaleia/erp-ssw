import { type Acesso, type EmpresaAtiva } from "@erp/shared/contracts/auth";
import { type FastifyRequest } from "fastify";

import { semEmpresa } from "../../models/errors";
import { type Executor, type ExecutorComContexto } from "../../models/repositories";
import { sessaoObrigatoria } from "./session";

/** Acesso com a empresa ativa garantida (para rotas que já passaram por um guard de empresa). */
export async function empresaDaRequisicao(
  request: FastifyRequest,
): Promise<{ acesso: Acesso; empresa: EmpresaAtiva }> {
  const acesso = await request.acesso();
  if (!acesso.empresa) throw semEmpresa();
  return { acesso, empresa: acesso.empresa };
}

/**
 * Executor com a Plataforma ligada, no contexto de uma empresa (ou de nenhuma). Só depois de um
 * guard que autorize: nas rotas da Plataforma, para operar a empresa alvo; no Admin, para ler a
 * pessoa inteira (vínculos em todas as empresas) antes de deixar mexer no login dela.
 */
export function executorDePlataforma(
  executar: ExecutorComContexto,
  request: FastifyRequest,
  empresaId: string | null,
): Executor {
  const { usuarioId } = sessaoObrigatoria(request);
  return (fn) => executar({ empresaId, usuarioId, plataforma: true }, fn);
}
