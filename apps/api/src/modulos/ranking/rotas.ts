import { ehTempoEsgotado } from "@erp/db";
import { PAPEL_ADMIN, PAPEL_GESTOR, PAPEL_SUPER_ADMIN } from "@erp/shared/acesso/papeis";
import { contratosRanking as c } from "@erp/shared/contratos/ranking";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { empresaDaRequisicao } from "../../http/contexto";
import { exigirModulo, exigirPapel, exigirTela } from "../../http/guardas";
import { atorDa } from "../../plugins/sessao";
import { type ExecutorComContexto } from "../../repositorios";
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
} from "./casos-de-uso";

/**
 * Ranking operacional: tela Ranking. Equipes e atribuição: tela Admin › Equipes. Regras, simulador
 * e detalhe da equipe: rotas `/ranking/*` (a guarda do front usa a tela Ranking). Gravar = gestão
 * (admin, super_admin, gestor). Tudo exige o módulo Ranking.
 */
const modulo = exigirModulo("ranking");
const gestao = exigirPapel(PAPEL_ADMIN, PAPEL_SUPER_ADMIN, PAPEL_GESTOR);
const lerRanking = [modulo, exigirTela("ranking")];
const lerEquipes = [modulo, exigirTela("admin_equipes")];
const gravarEquipes = [...lerEquipes, gestao];
const gravarRegras = [...lerRanking, gestao];

/** Link público: sem login, limitado por IP (cada IP abre no máximo 30 vezes por minuto). */
const LIMITE_DO_LINK_PUBLICO = { max: 30, timeWindow: "1 minute" };

async function contextoDe(request: FastifyRequest): Promise<ContextoRanking> {
  const { empresa } = await empresaDaRequisicao(request);
  return { empresaId: empresa.id, fuso: empresa.fuso };
}

const ok = { ok: true as const };

export const rotasRanking: FastifyPluginCallbackZod<{
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
    async (request) => listarEquipes(request.db, await contextoDe(request)),
  );

  app.post(
    c.salvarEquipe.caminho,
    {
      schema: { body: c.salvarEquipe.entrada, response: { 200: c.salvarEquipe.saida } },
      preHandler: gravarEquipes,
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
      preHandler: gravarEquipes,
    },
    async (request) => {
      await incluirMembro(
        request.db,
        await contextoDe(request),
        await atorDa(request),
        request.params.id,
        request.body,
      );
      return ok;
    },
  );

  app.delete(
    c.removerMembro.caminho,
    {
      schema: { params: c.removerMembro.parametros, response: { 200: c.removerMembro.saida } },
      preHandler: gravarEquipes,
    },
    async (request) => {
      await removerMembro(
        request.db,
        await contextoDe(request),
        await atorDa(request),
        request.params.id,
        agora(),
      );
      return ok;
    },
  );

  app.post(
    c.gerarLink.caminho,
    {
      schema: { params: c.gerarLink.parametros, response: { 200: c.gerarLink.saida } },
      preHandler: gravarEquipes,
    },
    async (request) =>
      gerarLink(request.db, await contextoDe(request), await atorDa(request), request.params.id),
  );

  app.delete(
    c.revogarLink.caminho,
    {
      schema: { params: c.revogarLink.parametros, response: { 200: c.revogarLink.saida } },
      preHandler: gravarEquipes,
    },
    async (request) => {
      await revogarLink(
        request.db,
        await contextoDe(request),
        await atorDa(request),
        request.params.id,
      );
      return ok;
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
    async (request) => ctesParaAtribuir(request.db, await contextoDe(request), request.query),
  );

  app.post(
    c.atribuir.caminho,
    {
      schema: { body: c.atribuir.entrada, response: { 200: c.atribuir.saida } },
      preHandler: gravarEquipes,
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
      preHandler: gravarRegras,
    },
    async (request) =>
      salvarRegra(request.db, await contextoDe(request), await atorDa(request), request.body),
  );

  app.delete(
    c.excluirRegra.caminho,
    {
      schema: { params: c.excluirRegra.parametros, response: { 200: c.excluirRegra.saida } },
      preHandler: gravarRegras,
    },
    async (request) => {
      await excluirRegra(
        request.db,
        await contextoDe(request),
        await atorDa(request),
        request.params.id,
      );
      return ok;
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
      simularRegra(request.db, await contextoDe(request), request.params.id, request.query),
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
    async (request) => rankingPublico({ executar, agora }, request.params.token, request.query),
  );

  pronto();
};
