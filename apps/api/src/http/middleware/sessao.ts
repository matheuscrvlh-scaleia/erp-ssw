import { type Acesso } from "@erp/shared/contratos/auth";
import { type FastifyInstance, type FastifyRequest } from "fastify";
import fp from "fastify-plugin";

import { type EmissorDeTokens, type SessaoDoToken } from "../../infra/tokens";
import { carregarAcesso, type DependenciasAcesso } from "../../models/acesso/acesso.service";
import { type Ator } from "../../models/auditoria/auditoria.service";
import { naoAutenticado, sessaoExpirada } from "../../models/erros";
import { type Executor, type ExecutorComContexto } from "../../models/repositorios";

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

/**
 * Acesso da sessão guardado por 30 s no processo. Montá-lo custa ~16 idas ao banco em sequência e
 * cada tela dispara várias chamadas juntas (que agora esperam a mesma carga). Toda escrita que deu
 * certo limpa o cache: logout, revogação e mudança de permissão valem na hora; o que mudar fora da
 * API vale em até 30 s.
 */
const VALIDADE_DO_ACESSO_MS = 30_000;
const METODOS_DE_LEITURA = new Set(["GET", "HEAD", "OPTIONS"]);

function criarCacheDeAcesso(agora: () => number) {
  const guardados = new Map<string, { ate: number; acesso: Promise<Acesso> }>();
  return {
    obter(sessao: SessaoDoToken, carregar: () => Promise<Acesso>): Promise<Acesso> {
      const chave = `${sessao.familiaId}|${sessao.usuarioId}|${sessao.empresaId ?? ""}`;
      const momento = agora();
      const guardado = guardados.get(chave);
      if (guardado && guardado.ate > momento) return guardado.acesso;
      for (const [k, g] of guardados) if (g.ate <= momento) guardados.delete(k);
      const acesso = carregar();
      guardados.set(chave, { ate: momento + VALIDADE_DO_ACESSO_MS, acesso });
      acesso.catch(() => {
        if (guardados.get(chave)?.acesso === acesso) guardados.delete(chave);
      });
      return acesso;
    },
    limpar: () => {
      guardados.clear();
    },
  };
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
    const cache = criarCacheDeAcesso(() => opcoes.agora().getTime());
    app.decorateRequest("sessao", null);
    app.decorateRequest("tokenRecusado", false);
    app.decorateRequest("acessoEmCache", null);
    app.decorateRequest("acesso", function (this: FastifyRequest) {
      const sessao = sessaoObrigatoria(this);
      this.acessoEmCache ??= cache.obter(sessao, () => carregarAcesso(opcoes, sessao));
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

    // Antes de responder, para a próxima chamada do cliente já ver a mudança.
    app.addHook("onSend", async (request, reply) => {
      if (!METODOS_DE_LEITURA.has(request.method) && reply.statusCode < 400) cache.limpar();
    });
  },
  { name: "sessao" },
);
