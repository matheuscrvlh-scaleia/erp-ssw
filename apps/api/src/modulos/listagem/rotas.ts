import { contratosListagem as c } from "@erp/shared/contratos/listagem";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { empresaDaRequisicao } from "../../http/contexto";
import { exigirModulo, exigirPermissao } from "../../http/guardas";
import {
  type ContextoListagem,
  exportarCtrcs,
  listarCodigosDoRecorte,
  listarCtrcs,
} from "./casos-de-uso";

/** `/performance/lista` é tela da Performance: módulo e tela iguais aos dela. */
const ler = [exigirModulo("performance"), exigirPermissao("performance", "ver")];

async function contextoDe(request: FastifyRequest): Promise<ContextoListagem> {
  const { empresa } = await empresaDaRequisicao(request);
  return { empresaId: empresa.id, fuso: empresa.fuso };
}

export const rotasListagem: FastifyPluginCallbackZod<{ agora: () => Date }> = (
  app,
  { agora },
  pronto,
) => {
  app.get(
    c.listar.caminho,
    {
      schema: { querystring: c.listar.entrada, response: { 200: c.listar.saida } },
      preHandler: ler,
    },
    async (request) => listarCtrcs(request.db, await contextoDe(request), request.query, agora()),
  );

  app.get(
    c.exportar.caminho,
    {
      schema: { querystring: c.exportar.entrada, response: { 200: c.exportar.saida } },
      preHandler: ler,
    },
    async (request) => exportarCtrcs(request.db, await contextoDe(request), request.query, agora()),
  );

  app.get(
    c.codigos.caminho,
    {
      schema: { querystring: c.codigos.entrada, response: { 200: c.codigos.saida } },
      preHandler: ler,
    },
    async (request) =>
      listarCodigosDoRecorte(request.db, await contextoDe(request), request.query, agora()),
  );
  pronto();
};
