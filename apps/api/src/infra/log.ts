import { erroParaLog } from "@erp/db";
import { type FastifyRequest, type FastifyServerOptions } from "fastify";

import { type Ambiente } from "../config";

/** Nada de segredo em log: token, cookie, senha, refresh e segredos de integração nunca são gravados. */
export const CAMINHOS_SENSIVEIS = [
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
  "segredo",
  "*.segredo",
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

/** Caminhos com segredo num segmento: o token do link público do ranking. */
const CAMINHOS_COM_SEGREDO = /^(\/(?:api\/public\/ranking|ranking\/publico)\/)[^/?#]+/i;

/**
 * Devolve a URL com o valor dos parâmetros sensíveis e o segmento de segredo do caminho trocados
 * por `[oculto]`.
 */
export function mascararUrl(url: string): string {
  const mascarada = url.replace(CAMINHOS_COM_SEGREDO, "$1[oculto]");
  const inicioQuery = mascarada.indexOf("?");
  if (inicioQuery === -1) return mascarada;
  const caminho = mascarada.slice(0, inicioQuery);
  const pares = mascarada
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
      // Erro do Drizzle leva SQL e parâmetros na mensagem: sai sem eles.
      err: erroParaLog,
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
