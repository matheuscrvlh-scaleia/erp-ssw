import { timingSafeEqual } from "node:crypto";

import { ErroDeNegocio } from "@erp/dominio/erros";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { type FastifyInstance } from "fastify";
import { jsonSchemaTransform } from "fastify-type-provider-zod";
import { collectDefaultMetrics, Histogram, Registry } from "prom-client";

export interface Prontidao {
  /** Cada verificação lança se a dependência não responde. */
  verificacoes: Record<string, () => Promise<void>>;
}

/** Liveness (`/healthz`, processo de pé) e readiness (`/readyz`, banco e Redis respondendo). */
export function registrarSaude(app: FastifyInstance, prontidao: Prontidao) {
  app.get("/healthz", { config: { rateLimit: false } }, () => ({ status: "ok" }));
  app.get("/readyz", { config: { rateLimit: false } }, async (request) => {
    const falhas: string[] = [];
    for (const [nome, verificar] of Object.entries(prontidao.verificacoes)) {
      try {
        await verificar();
      } catch (erro) {
        request.log.warn({ err: erro, dependencia: nome }, "dependência fora");
        falhas.push(nome);
      }
    }
    if (falhas.length > 0) {
      throw new ErroDeNegocio("INDISPONIVEL", `Dependência indisponível: ${falhas.join(", ")}.`);
    }
    return { status: "pronto" };
  });
}

function mesmoToken(recebido: string | undefined, esperado: string): boolean {
  const a = Buffer.from(recebido ?? "");
  const b = Buffer.from(`Bearer ${esperado}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Métricas Prometheus em `/metrics`, só com o token (a rota não existe sem ele). */
export function registrarMetricas(app: FastifyInstance, token: string | undefined) {
  if (!token) return;
  const registro = new Registry();
  collectDefaultMetrics({ register: registro });
  const duracao = new Histogram({
    name: "http_requisicao_duracao_segundos",
    help: "Duração das requisições HTTP",
    labelNames: ["metodo", "rota", "status"],
    registers: [registro],
  });

  app.addHook("onResponse", async (request, reply) => {
    duracao.observe(
      {
        metodo: request.method,
        // Padrão da rota (`/feriados/:id`), não a URL: evita uma série por id.
        rota: request.routeOptions.url ?? "desconhecida",
        status: String(reply.statusCode),
      },
      reply.elapsedTime / 1000,
    );
  });

  app.get("/metrics", { config: { rateLimit: false } }, async (request, reply) => {
    if (!mesmoToken(request.headers.authorization, token)) {
      throw new ErroDeNegocio("NAO_AUTENTICADO", "Token de métricas inválido.");
    }
    return reply.type(registro.contentType).send(await registro.metrics());
  });
}

/** OpenAPI gerado dos contratos zod; swagger-ui em `/docs` (fora de produção). */
export async function registrarDocumentacao(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: { info: { title: "ERP SSW — API", version: "1" } },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
}
