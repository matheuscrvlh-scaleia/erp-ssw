import { ErroDeNegocio } from "@erp/dominio/erros";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import underPressure from "@fastify/under-pressure";
import { type FastifyInstance } from "fastify";
import { type Redis } from "ioredis";

import { type Ambiente, origensPermitidas } from "../config/env";
import { muitasTentativas } from "../http/erros";

export interface OpcoesSeguranca {
  ambiente: Ambiente;
  redis: Redis | null;
  /** Documentação interativa (swagger-ui) precisa de CSP mais solta. */
  comDocumentacao: boolean;
}

/** Cabeçalhos, CORS, cookies, limite de taxa (Redis) e proteção contra sobrecarga. */
export async function registrarSeguranca(app: FastifyInstance, opcoes: OpcoesSeguranca) {
  await app.register(sensible);
  await app.register(helmet, { contentSecurityPolicy: !opcoes.comDocumentacao });
  await app.register(cors, {
    origin: origensPermitidas(opcoes.ambiente),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  });
  await app.register(cookie, { secret: opcoes.ambiente.COOKIE_SEGREDO });
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
    // Sem Redis (só em desenvolvimento/teste) o contador fica na memória do processo.
    ...(opcoes.redis ? { redis: opcoes.redis, nameSpace: "erp-api-limite:" } : {}),
    errorResponseBuilder: () => muitasTentativas(),
  });
  await app.register(underPressure, {
    maxEventLoopDelay: 1_000,
    customError: class SobreCarga extends ErroDeNegocio {
      constructor() {
        super("INDISPONIVEL", "O sistema está sobrecarregado. Tente de novo em instantes.");
      }
    },
  });
}
