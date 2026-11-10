import { type Acesso, type EmpresaAtiva } from "@erp/shared/contratos/auth";
import { type FastifyRequest } from "fastify";

import { semEmpresa } from "./erros";

/** Acesso com a empresa ativa garantida (para rotas que já passaram por um guard de empresa). */
export async function empresaDaRequisicao(
  request: FastifyRequest,
): Promise<{ acesso: Acesso; empresa: EmpresaAtiva }> {
  const acesso = await request.acesso();
  if (!acesso.empresa) throw semEmpresa();
  return { acesso, empresa: acesso.empresa };
}
