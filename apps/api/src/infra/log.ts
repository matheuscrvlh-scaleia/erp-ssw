import { type FastifyRequest, type FastifyServerOptions } from "fastify";

import { type Ambiente } from "../config/env";

/** Nada de segredo em log: token, cookie, senha e o refresh nunca são gravados. */
const CAMINHOS_SENSIVEIS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
  "senha",
  "*.senha",
  "token",
  "*.token",
  "tokenAcesso",
  "*.tokenAcesso",
];

/** O webhook do SSW pode mandar o segredo na URL (`?secret=`): ele sai mascarado no log. */
export function mascararSegredoDaUrl(url: string): string {
  return url.replace(/([?&]secret=)[^&#]*/gi, "$1[oculto]");
}

function serializarRequisicao(request: FastifyRequest) {
  return {
    method: request.method,
    url: mascararSegredoDaUrl(request.url),
    host: request.host,
    remoteAddress: request.ip,
  };
}

export function opcoesDeLog(ambiente: Ambiente): NonNullable<FastifyServerOptions["logger"]> {
  if (ambiente.NODE_ENV === "test") return false;
  return {
    level: ambiente.LOG_NIVEL,
    redact: { paths: CAMINHOS_SENSIVEIS, censor: "[oculto]" },
    base: { servico: "erp-api" },
    serializers: { req: serializarRequisicao },
  };
}
