import { ErroDeNegocio } from "@erp/dominio/erros";
import { contratosAuth as c } from "@erp/shared/contratos/auth";
import { type FastifyReply, type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import {
  ajudaDeAcesso,
  definirSenhaPorToken,
  type DependenciasAuth,
  entrar,
  type Origem,
  pedirRedefinicao,
  renovar,
  sair,
  type SessaoEmitida,
  trocarEmpresa,
} from "../models/auth/auth.service";
import { sessaoExpirada } from "../models/erros";
import {
  apresentarAjudaDeAcesso,
  apresentarPedidoDeRedefinicao,
  apresentarToken,
} from "../views/auth.view";
import { confirmacao } from "../views/comum.view";
import { exigirAutenticacao } from "./middleware/guardas";
import { sessaoObrigatoria } from "./middleware/sessao";

const COOKIE_REFRESH = "erp_refresh";
const CAMINHO_DO_COOKIE = "/api/v1/auth";

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
}

function apagarRefresh(reply: FastifyReply) {
  reply.clearCookie(COOKIE_REFRESH, { path: CAMINHO_DO_COOKIE });
}

interface OpcoesRotasAuth {
  deps: DependenciasAuth;
}

export const controladorAuth: FastifyPluginCallbackZod<OpcoesRotasAuth> = (
  app,
  { deps },
  pronto,
) => {
  app.post(
    c.login.caminho,
    {
      schema: { body: c.login.entrada, response: { 200: c.login.saida } },
      config: limite(10, 1),
    },
    async (request, reply) => {
      const sessao = await entrar(deps, request.body, origemDa(request));
      gravarRefresh(reply, sessao);
      return apresentarToken(sessao);
    },
  );

  app.post(
    c.renovar.caminho,
    { schema: { response: { 200: c.renovar.saida } } },
    async (request, reply) => {
      const token = request.cookies[COOKIE_REFRESH];
      try {
        if (!token) throw sessaoExpirada();
        const sessao = await renovar(deps, token, origemDa(request));
        gravarRefresh(reply, sessao);
        return apresentarToken(sessao);
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
      return confirmacao();
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
    async (request) =>
      apresentarAjudaDeAcesso(await ajudaDeAcesso(deps, sessaoObrigatoria(request))),
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
      return apresentarPedidoDeRedefinicao();
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
      return confirmacao();
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
      return confirmacao();
    },
  );

  pronto();
};
