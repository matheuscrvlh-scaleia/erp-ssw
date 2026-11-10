import { type FastifyServerOptions } from "fastify";

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
  "segredo",
  "*.segredo",
];

export function opcoesDeLog(ambiente: Ambiente): NonNullable<FastifyServerOptions["logger"]> {
  if (ambiente.NODE_ENV === "test") return false;
  return {
    level: ambiente.LOG_NIVEL,
    redact: { paths: CAMINHOS_SENSIVEIS, censor: "[oculto]" },
    base: { servico: "erp-api" },
  };
}
