import { contratosFiltrosCtrc as c } from "@erp/shared/contratos/filtros-ctrc";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { empresaDaRequisicao } from "../../http/contexto";
import { exigirEmpresa } from "../../http/guardas";
import {
  type ContextoFiltros,
  listarPagadores,
  listarTiposDocumento,
  listarUnidadesResponsaveis,
  sugerirTexto,
} from "./casos-de-uso";

/** Opções de filtro servem a várias telas: exigem só sessão com empresa (como hoje). */
const ler = [exigirEmpresa];

async function contextoDe(request: FastifyRequest): Promise<ContextoFiltros> {
  const { empresa } = await empresaDaRequisicao(request);
  return { empresaId: empresa.id };
}

export const rotasFiltrosCtrc: FastifyPluginCallbackZod = (app, _opcoes, pronto) => {
  app.post(
    c.unidadesResponsaveis.caminho,
    {
      schema: {
        body: c.unidadesResponsaveis.entrada,
        response: { 200: c.unidadesResponsaveis.saida },
      },
      preHandler: ler,
    },
    async (request) =>
      listarUnidadesResponsaveis(request.db, await contextoDe(request), request.body),
  );

  app.post(
    c.sugestoesTexto.caminho,
    {
      schema: { body: c.sugestoesTexto.entrada, response: { 200: c.sugestoesTexto.saida } },
      preHandler: ler,
    },
    async (request) => sugerirTexto(request.db, await contextoDe(request), request.body),
  );

  app.post(
    c.pagadores.caminho,
    {
      schema: { body: c.pagadores.entrada, response: { 200: c.pagadores.saida } },
      preHandler: ler,
    },
    async (request) => listarPagadores(request.db, await contextoDe(request), request.body),
  );

  app.get(
    c.tiposDocumento.caminho,
    { schema: { response: { 200: c.tiposDocumento.saida } }, preHandler: ler },
    async (request) => listarTiposDocumento(request.db, await contextoDe(request)),
  );
  pronto();
};
