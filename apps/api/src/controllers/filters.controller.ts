import { contratosFiltros as c } from "@erp/shared/contracts/filters";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import {
  type ContextoFiltros,
  listarCodigos,
  listarFiliaisProprias,
  listarPagadores,
  listarSugestoes,
  listarTiposDocumento,
  listarTiposDocumentoNoPeriodo,
  obterOpcoes,
} from "../models/filters/filters.service";
import { apresentarCodigos, apresentarOpcoes, apresentarPagadores } from "../views/filters.view";
import { empresaDaRequisicao } from "./middleware/context";
import { exigirEmpresa } from "./middleware/guards";

/**
 * Filtros compartilhados pelas telas de CT-e (Performance, Lista, Romaneio, Ocorrências,
 * Comprovantes): basta sessão com empresa, como hoje — cada tela já tem a própria guarda.
 */
const ler = [exigirEmpresa];

async function contextoDe(request: FastifyRequest): Promise<ContextoFiltros> {
  const { empresa } = await empresaDaRequisicao(request);
  return { empresaId: empresa.id, fuso: empresa.fuso };
}

export const controladorFiltros: FastifyPluginCallbackZod = (app, _opcoes, pronto) => {
  app.get(
    c.filiaisProprias.caminho,
    { schema: { response: { 200: c.filiaisProprias.saida } }, preHandler: ler },
    async (request) => listarFiliaisProprias(request.db, await contextoDe(request)),
  );

  app.get(
    c.opcoes.caminho,
    {
      schema: { querystring: c.opcoes.entrada, response: { 200: c.opcoes.saida } },
      preHandler: ler,
    },
    async (request) =>
      apresentarOpcoes(await obterOpcoes(request.db, await contextoDe(request), request.query)),
  );

  app.get(
    c.codigos.caminho,
    { schema: { response: { 200: c.codigos.saida } }, preHandler: ler },
    async (request) =>
      apresentarCodigos(await listarCodigos(request.db, await contextoDe(request))),
  );

  app.get(
    c.sugestoes.caminho,
    {
      schema: { querystring: c.sugestoes.entrada, response: { 200: c.sugestoes.saida } },
      preHandler: ler,
    },
    async (request) => listarSugestoes(request.db, await contextoDe(request), request.query),
  );

  app.get(
    c.pagadores.caminho,
    {
      schema: { querystring: c.pagadores.entrada, response: { 200: c.pagadores.saida } },
      preHandler: ler,
    },
    async (request) =>
      apresentarPagadores(
        await listarPagadores(request.db, await contextoDe(request), request.query),
      ),
  );

  app.get(
    c.tiposDocumento.caminho,
    { schema: { response: { 200: c.tiposDocumento.saida } }, preHandler: ler },
    async (request) => listarTiposDocumento(request.db, await contextoDe(request)),
  );

  app.get(
    c.tiposDocumentoNoPeriodo.caminho,
    {
      schema: {
        querystring: c.tiposDocumentoNoPeriodo.entrada,
        response: { 200: c.tiposDocumentoNoPeriodo.saida },
      },
      preHandler: ler,
    },
    async (request) =>
      listarTiposDocumentoNoPeriodo(request.db, await contextoDe(request), request.query),
  );
  pronto();
};
