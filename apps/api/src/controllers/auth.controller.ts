import { ErroDeNegocio } from "@erp/dominio/erros";
import { destinoInterno } from "@erp/shared/acesso/destino";
import { CAMINHOS_GOOGLE, contratosAuth as c } from "@erp/shared/contratos/auth";
import { z } from "@erp/shared/zod";
import { type FastifyReply, type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { exigirAutenticacao } from "../http/middleware/guardas";
import { sessaoObrigatoria } from "../http/middleware/sessao";
import { type ProvedorGoogle } from "../infra/google";
import {
  ajudaDeAcesso,
  definirSenhaPorToken,
  type DependenciasAuth,
  entrar,
  entrarComGoogle,
  type Origem,
  pedirRedefinicao,
  renovar,
  sair,
  type SessaoEmitida,
  trocarEmpresa,
} from "../models/auth/auth.service";
import { sessaoExpirada } from "../models/erros";

const COOKIE_REFRESH = "erp_refresh";
const COOKIE_GOOGLE = "erp_google";
const CAMINHO_DO_COOKIE = "/api/v1/auth";

const MENSAGEM_ESQUECI =
  "Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.";

const limite = (max: number, minutos: number) => ({
  rateLimit: { max, timeWindow: `${minutos} minutes` },
});

function origemDa(request: FastifyRequest): Origem {
  return { ip: request.ip, userAgent: request.headers["user-agent"] ?? null };
}

/** Refresh só no cookie httpOnly, preso ao caminho de auth: o JavaScript da página nunca o lê. */
function gravarRefresh(reply: FastifyReply, sessao: SessaoEmitida) {
  reply.setCookie(COOKIE_REFRESH, sessao.refresh.token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: CAMINHO_DO_COOKIE,
    expires: sessao.refresh.expiraEm,
  });
  return { tokenAcesso: sessao.tokenAcesso, expiraEmSegundos: sessao.expiraEmSegundos };
}

function apagarRefresh(reply: FastifyReply) {
  reply.clearCookie(COOKIE_REFRESH, { path: CAMINHO_DO_COOKIE });
}

const desafioGuardado = z.object({
  verificador: z.string(),
  estado: z.string(),
  nonce: z.string(),
  destino: z.string(),
});

/** Desafio do Google guardado no cookie assinado; nulo se faltou, foi adulterado ou expirou. */
function lerDesafio(request: FastifyRequest): z.infer<typeof desafioGuardado> | null {
  const bruto = request.cookies[COOKIE_GOOGLE];
  const assinado = bruto ? request.unsignCookie(bruto) : null;
  if (!assinado?.valid) return null;
  try {
    return desafioGuardado.parse(JSON.parse(assinado.value));
  } catch {
    return null;
  }
}

export interface OpcoesRotasAuth {
  deps: DependenciasAuth;
  google: ProvedorGoogle | null;
  /** URL registrada no Google para a volta (a requisição chega com o caminho dela). */
  googleRedirectUri: string | null;
}

export const controladorAuth: FastifyPluginCallbackZod<OpcoesRotasAuth> = (
  app,
  { deps, google, googleRedirectUri },
  pronto,
) => {
  app.get(c.provedores.caminho, { schema: { response: { 200: c.provedores.saida } } }, () => ({
    google: google !== null,
  }));

  app.post(
    c.login.caminho,
    {
      schema: { body: c.login.entrada, response: { 200: c.login.saida } },
      config: limite(10, 1),
    },
    async (request, reply) =>
      gravarRefresh(reply, await entrar(deps, request.body, origemDa(request))),
  );

  app.post(
    c.renovar.caminho,
    { schema: { response: { 200: c.renovar.saida } } },
    async (request, reply) => {
      const token = request.cookies[COOKIE_REFRESH];
      try {
        if (!token) throw sessaoExpirada();
        return gravarRefresh(reply, await renovar(deps, token, origemDa(request)));
      } catch (erro) {
        // Refresh recusado: apaga o cookie para o navegador não insistir com ele.
        if (erro instanceof ErroDeNegocio) apagarRefresh(reply);
        throw erro;
      }
    },
  );

  app.post(
    c.sair.caminho,
    { schema: { response: { 200: c.sair.saida } } },
    async (request, reply) => {
      await sair(deps, request.cookies[COOKIE_REFRESH]);
      apagarRefresh(reply);
      return { ok: true as const };
    },
  );

  app.get(
    c.eu.caminho,
    { schema: { response: { 200: c.eu.saida } }, preHandler: [exigirAutenticacao] },
    (request) => request.acesso(),
  );

  app.post(
    c.trocarEmpresa.caminho,
    {
      schema: { body: c.trocarEmpresa.entrada, response: { 200: c.trocarEmpresa.saida } },
      preHandler: [exigirAutenticacao],
    },
    (request) =>
      trocarEmpresa(deps, sessaoObrigatoria(request), request.body.empresaId, origemDa(request)),
  );

  app.get(
    c.ajudaAcesso.caminho,
    { schema: { response: { 200: c.ajudaAcesso.saida } }, preHandler: [exigirAutenticacao] },
    (request) => ajudaDeAcesso(deps, sessaoObrigatoria(request)),
  );

  app.post(
    c.esqueciSenha.caminho,
    {
      schema: { body: c.esqueciSenha.entrada, response: { 200: c.esqueciSenha.saida } },
      config: limite(5, 15),
    },
    (request) => {
      // Não espera o envio: o tempo de resposta não pode dizer se o e-mail existe.
      void pedirRedefinicao(deps, request.body.email).catch((erro: unknown) => {
        request.log.error({ err: erro }, "falha ao enviar e-mail de redefinição");
      });
      return { mensagem: MENSAGEM_ESQUECI };
    },
  );

  app.post(
    c.redefinirSenha.caminho,
    {
      schema: { body: c.redefinirSenha.entrada, response: { 200: c.redefinirSenha.saida } },
      config: limite(10, 15),
    },
    async (request) => {
      const { token, senha } = request.body;
      await definirSenhaPorToken(
        deps,
        { tipo: "redefinicao", token, senha, nome: null },
        origemDa(request),
      );
      return { ok: true as const };
    },
  );

  app.post(
    c.aceitarConvite.caminho,
    {
      schema: { body: c.aceitarConvite.entrada, response: { 200: c.aceitarConvite.saida } },
      config: limite(10, 15),
    },
    async (request) => {
      const { token, senha, nome } = request.body;
      await definirSenhaPorToken(
        deps,
        { tipo: "convite", token, senha, nome: nome ?? null },
        origemDa(request),
      );
      return { ok: true as const };
    },
  );

  if (google && googleRedirectUri) registrarGoogle(app, deps, google, googleRedirectUri);
  pronto();
};

/** Login pelo Google (só existe com as variáveis configuradas). */
function registrarGoogle(
  app: Parameters<FastifyPluginCallbackZod>[0],
  deps: DependenciasAuth,
  google: ProvedorGoogle,
  googleRedirectUri: string,
) {
  app.get(
    CAMINHOS_GOOGLE.iniciar,
    {
      schema: { querystring: z.object({ redirect: z.string().max(500).optional() }) },
      config: limite(20, 1),
    },
    async (request, reply) => {
      const { url, desafio } = await google.iniciar();
      const guardado = {
        ...desafio, // Volta do Google só para caminho interno da mesma origem (evita redirecionamento aberto).
        destino: destinoInterno(request.query.redirect, await deps.webUrl()),
      };
      // SameSite=Lax: a volta do Google é navegação de outro site e precisa trazer o cookie.
      reply.setCookie(COOKIE_GOOGLE, JSON.stringify(guardado), {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        signed: true,
        path: CAMINHOS_GOOGLE.iniciar,
        maxAge: 600,
      });
      return reply.redirect(url);
    },
  );

  app.get(CAMINHOS_GOOGLE.retorno, { config: limite(20, 1) }, async (request, reply) => {
    const guardado = lerDesafio(request);
    reply.clearCookie(COOKIE_GOOGLE, { path: CAMINHOS_GOOGLE.iniciar });
    if (!guardado) return reply.redirect("/login?erro=falhou");

    const urlDeRetorno = new URL(googleRedirectUri);
    urlDeRetorno.search = new URL(request.url, urlDeRetorno).search;
    let destino = "/login?erro=falhou";
    try {
      const identidade = await google.concluir(urlDeRetorno, guardado);
      const sessao = await entrarComGoogle(deps, identidade, origemDa(request));
      if (sessao) gravarRefresh(reply, sessao);
      destino = sessao ? guardado.destino : "/login?erro=sem_conta";
    } catch (erro) {
      request.log.warn({ err: erro }, "login pelo Google falhou");
    }
    return reply.redirect(destino);
  });
}
