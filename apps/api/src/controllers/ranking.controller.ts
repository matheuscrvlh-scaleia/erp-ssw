import { ehTempoEsgotado } from "@erp/db";
import { contratosRanking as c } from "@erp/shared/contracts/ranking";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import {
  atribuirEquipe,
  calcularEquipe,
  type ContextoRanking,
  ctesParaAtribuir,
  excluirRegra,
  gerarLink,
  incluirMembro,
  listarEquipes,
  listarRegras,
  rankingOperacional,
  rankingPublico,
  removerMembro,
  revogarLink,
  salvarEquipe,
  salvarRegra,
  simularRegra,
} from "../models/ranking/ranking.service";
import { type ExecutorComContexto } from "../models/repositories";
import { confirmacao } from "../views/common.view";
import {
  apresentarCtesParaAtribuir,
  apresentarEquipes,
  apresentarRankingPublico,
  apresentarSimulacao,
} from "../views/ranking.view";
import { empresaDaRequisicao } from "./middleware/context";
import { exigirModulo, exigirPermissao } from "./middleware/guards";
import { atorDa } from "./middleware/session";

/**
 * Ranking operacional: tela Ranking. Equipes e atribuição: tela Admin › Equipes. Regras, simulador
 * e detalhe da equipe: rotas `/ranking/*` (a guarda do front usa a tela Ranking). Gravar = gestão
 * (admin, super_admin, gestor). Tudo exige o módulo Ranking.
 */
const modulo = exigirModulo("ranking");
const lerRanking = [modulo, exigirPermissao("ranking", "ver")];
const lerEquipes = [modulo, exigirPermissao("admin_equipes", "ver")];
const editarEquipes = [modulo, exigirPermissao("admin_equipes", "editar")];
const excluirDeEquipes = [modulo, exigirPermissao("admin_equipes", "excluir")];
/** Regras de bonificação (Ranking › Regras) são da tela "Bonificação". */
const editarRegras = [modulo, exigirPermissao("admin_bonificacao", "editar")];
const excluirRegras = [modulo, exigirPermissao("admin_bonificacao", "excluir")];

/** Link público: sem login, limitado por IP (cada IP abre no máximo 30 vezes por minuto). */
const LIMITE_DO_LINK_PUBLICO = { max: 30, timeWindow: "1 minute" };

async function contextoDe(request: FastifyRequest): Promise<ContextoRanking> {
  const { empresa } = await empresaDaRequisicao(request);
  return { empresaId: empresa.id, fuso: empresa.fuso };
}

export const controladorRanking: FastifyPluginCallbackZod<{
  agora: () => Date;
  executar: ExecutorComContexto;
}> = (app, { agora, executar }, pronto) => {
  app.post(
    c.operacional.caminho,
    {
      schema: { body: c.operacional.entrada, response: { 200: c.operacional.saida } },
      preHandler: lerRanking,
    },
    async (request) =>
      rankingOperacional(request.db, await contextoDe(request), request.body, {
        agora: agora(),
        esperar: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
        ehTempoEsgotado,
      }),
  );

  app.get(
    c.equipes.caminho,
    { schema: { response: { 200: c.equipes.saida } }, preHandler: lerEquipes },
    async (request) =>
      apresentarEquipes(await listarEquipes(request.db, await contextoDe(request))),
  );

  app.post(
    c.salvarEquipe.caminho,
    {
      schema: { body: c.salvarEquipe.entrada, response: { 200: c.salvarEquipe.saida } },
      preHandler: editarEquipes,
    },
    async (request) =>
      salvarEquipe(request.db, await contextoDe(request), await atorDa(request), request.body),
  );

  app.post(
    c.incluirMembro.caminho,
    {
      schema: {
        params: c.incluirMembro.parametros,
        body: c.incluirMembro.entrada,
        response: { 200: c.incluirMembro.saida },
      },
      preHandler: editarEquipes,
    },
    async (request) => {
      await incluirMembro(
        request.db,
        await contextoDe(request),
        await atorDa(request),
        request.params.id,
        request.body,
      );
      return confirmacao();
    },
  );

  app.delete(
    c.removerMembro.caminho,
    {
      schema: { params: c.removerMembro.parametros, response: { 200: c.removerMembro.saida } },
      preHandler: excluirDeEquipes,
    },
    async (request) => {
      await removerMembro(
        request.db,
        await contextoDe(request),
        await atorDa(request),
        request.params.id,
        agora(),
      );
      return confirmacao();
    },
  );

  app.post(
    c.gerarLink.caminho,
    {
      schema: { params: c.gerarLink.parametros, response: { 200: c.gerarLink.saida } },
      preHandler: editarEquipes,
    },
    async (request) =>
      gerarLink(request.db, await contextoDe(request), await atorDa(request), request.params.id),
  );

  app.delete(
    c.revogarLink.caminho,
    {
      schema: { params: c.revogarLink.parametros, response: { 200: c.revogarLink.saida } },
      preHandler: excluirDeEquipes,
    },
    async (request) => {
      await revogarLink(
        request.db,
        await contextoDe(request),
        await atorDa(request),
        request.params.id,
      );
      return confirmacao();
    },
  );

  app.get(
    c.ctesParaAtribuir.caminho,
    {
      schema: {
        querystring: c.ctesParaAtribuir.entrada,
        response: { 200: c.ctesParaAtribuir.saida },
      },
      preHandler: lerEquipes,
    },
    async (request) =>
      apresentarCtesParaAtribuir(
        await ctesParaAtribuir(request.db, await contextoDe(request), request.query),
      ),
  );

  app.post(
    c.atribuir.caminho,
    {
      schema: { body: c.atribuir.entrada, response: { 200: c.atribuir.saida } },
      preHandler: editarEquipes,
    },
    async (request) =>
      atribuirEquipe(request.db, await contextoDe(request), await atorDa(request), request.body),
  );

  app.get(
    c.regras.caminho,
    { schema: { response: { 200: c.regras.saida } }, preHandler: lerRanking },
    async (request) => listarRegras(request.db, await contextoDe(request)),
  );

  app.post(
    c.salvarRegra.caminho,
    {
      schema: { body: c.salvarRegra.entrada, response: { 200: c.salvarRegra.saida } },
      preHandler: editarRegras,
    },
    async (request) =>
      salvarRegra(request.db, await contextoDe(request), await atorDa(request), request.body),
  );

  app.delete(
    c.excluirRegra.caminho,
    {
      schema: { params: c.excluirRegra.parametros, response: { 200: c.excluirRegra.saida } },
      preHandler: excluirRegras,
    },
    async (request) => {
      await excluirRegra(
        request.db,
        await contextoDe(request),
        await atorDa(request),
        request.params.id,
      );
      return confirmacao();
    },
  );

  app.get(
    c.simularRegra.caminho,
    {
      schema: {
        params: c.simularRegra.parametros,
        querystring: c.simularRegra.entrada,
        response: { 200: c.simularRegra.saida },
      },
      preHandler: lerRanking,
    },
    async (request) =>
      apresentarSimulacao(
        await simularRegra(request.db, await contextoDe(request), request.params.id, request.query),
      ),
  );

  app.get(
    c.calculoDaEquipe.caminho,
    {
      schema: {
        params: c.calculoDaEquipe.parametros,
        querystring: c.calculoDaEquipe.entrada,
        response: { 200: c.calculoDaEquipe.saida },
      },
      preHandler: lerRanking,
    },
    async (request) =>
      calcularEquipe(request.db, await contextoDe(request), request.params.id, request.query),
  );

  app.get(
    c.publico.caminho,
    {
      config: { rateLimit: LIMITE_DO_LINK_PUBLICO },
      schema: {
        params: c.publico.parametros,
        querystring: c.publico.entrada,
        response: { 200: c.publico.saida },
      },
    },
    async (request) =>
      apresentarRankingPublico(
        await rankingPublico({ executar, agora }, request.params.token, request.query),
      ),
  );

  pronto();
};
