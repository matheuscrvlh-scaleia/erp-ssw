import { type FastifyRequest, type FastifyServerOptions } from "fastify";

import { type Ambiente } from "../config/env";

/** Nada de segredo em log: token, cookie, senha, refresh e segredos de integração nunca são gravados. */
const CAMINHOS_SENSIVEIS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["x-ftp-ingest-secret"]',
  'req.headers["x-ingest-secret"]',
  'req.headers["x-cron-token"]',
  'res.headers["set-cookie"]',
  "senha",
  "*.senha",
  "token",
  "*.token",
  "tokenAcesso",
  "*.tokenAcesso",
];

/** Parâmetros de query que carregam segredo (webhook do SSW manda `?secret=`; OAuth manda `code`/`state`). */
const PARAMETROS_SENSIVEIS = new Set([
  "secret",
  "token",
  "code",
  "state",
  "senha",
  "apikey",
  "key",
]);

/** Devolve a URL com o valor dos parâmetros sensíveis trocado por `[oculto]`. */
export function mascararUrl(url: string): string {
  const inicioQuery = url.indexOf("?");
  if (inicioQuery === -1) return url;
  const caminho = url.slice(0, inicioQuery);
  const pares = url
    .slice(inicioQuery + 1)
    .split("&")
    .map((par) => {
      const igual = par.indexOf("=");
      const nome = igual === -1 ? par : par.slice(0, igual);
      return PARAMETROS_SENSIVEIS.has(decodeURIComponent(nome).toLowerCase())
        ? `${nome}=[oculto]`
        : par;
    });
  return `${caminho}?${pares.join("&")}`;
}

export function opcoesDeLog(ambiente: Ambiente): NonNullable<FastifyServerOptions["logger"]> {
  if (ambiente.NODE_ENV === "test") return false;
  return {
    level: ambiente.LOG_NIVEL,
    redact: { paths: CAMINHOS_SENSIVEIS, censor: "[oculto]" },
    base: { servico: "erp-api" },
    serializers: {
      req: (req: FastifyRequest) => ({
        method: req.method,
        url: mascararUrl(req.url),
        host: req.host,
        remoteAddress: req.ip,
        headers: req.headers,
      }),
    },
  };
}
