import { type Acesso } from "@erp/shared/contratos/auth";
import { type FastifyInstance, type FastifyRequest } from "fastify";
import fp from "fastify-plugin";

import { naoAutenticado, sessaoExpirada } from "../http/erros";
import { type EmissorDeTokens, type SessaoDoToken } from "../infra/tokens";
import { carregarAcesso, type DependenciasAcesso } from "../modulos/acesso/casos-de-uso";
import { type Ator } from "../modulos/auditoria/auditoria";
import { type Executor, type ExecutorComContexto } from "../repositorios";

declare module "fastify" {
  interface FastifyRequest {
    /** Sessão do access token (Bearer), ou nulo se não veio ou não vale. */
    sessao: SessaoDoToken | null;
    tokenRecusado: boolean;
    acessoEmCache: Promise<Acesso> | null;
    /** Acesso da sessão (telas, módulos, empresa), carregado uma vez por requisição. */
    acesso(): Promise<Acesso>;
    /** Executor no contexto da sessão: transação com SET LOCAL de empresa, usuário e Plataforma. */
    readonly db: Executor;
  }
}

export interface OpcoesSessao extends DependenciasAcesso {
  tokens: EmissorDeTokens;
  executar: ExecutorComContexto;
}

function tokenDoCabecalho(request: FastifyRequest): string | null {
  const [tipo, token] = request.headers.authorization?.split(" ") ?? [];
  return tipo?.toLowerCase() === "bearer" && token ? token : null;
}

export function sessaoObrigatoria(request: FastifyRequest): SessaoDoToken {
  if (request.sessao) return request.sessao;
  throw request.tokenRecusado ? sessaoExpirada() : naoAutenticado();
}

export async function atorDa(request: FastifyRequest): Promise<Ator> {
  const acesso = await request.acesso();
  return {
    usuarioId: acesso.usuario.id,
    email: acesso.usuario.email,
    plataforma: acesso.adminPlataforma,
    ip: request.ip,
    userAgent: request.headers["user-agent"] ?? null,
  };
}

/**
 * Lê o Bearer de toda requisição e disponibiliza `request.acesso()` e `request.db`. Não barra
 * nada: quem barra são os guards de cada rota.
 */
export const pluginSessao = fp(
  (app: FastifyInstance, opcoes: OpcoesSessao) => {
    app.decorateRequest("sessao", null);
    app.decorateRequest("tokenRecusado", false);
    app.decorateRequest("acessoEmCache", null);
    app.decorateRequest("acesso", function (this: FastifyRequest) {
      this.acessoEmCache ??= carregarAcesso(opcoes, sessaoObrigatoria(this));
      return this.acessoEmCache;
    });
    app.decorateRequest("db", {
      getter(this: FastifyRequest): Executor {
        return async (fn) => {
          const acesso = await this.acesso();
          return opcoes.executar(
            {
              empresaId: acesso.empresa?.id ?? null,
              usuarioId: acesso.usuario.id,
              plataforma: acesso.adminPlataforma,
            },
            fn,
          );
        };
      },
    });

    app.addHook("onRequest", async (request) => {
      const token = tokenDoCabecalho(request);
      if (!token) return;
      const resultado = await opcoes.tokens.verificar(token);
      if (resultado.valido) request.sessao = resultado.sessao;
      else request.tokenRecusado = true;
    });
  },
  { name: "sessao" },
);
