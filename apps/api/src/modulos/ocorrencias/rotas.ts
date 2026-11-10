import { contratosOcorrencias as c } from "@erp/shared/contratos/ocorrencias";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { empresaDaRequisicao } from "../../http/contexto";
import { exigirModulo, exigirTela } from "../../http/guardas";
import {
  type ContextoOcorrencias,
  listarConferentes,
  obterCodigosDoCard,
  obterLista,
  obterOpcoes,
  obterPainel,
} from "./casos-de-uso";

const ler = [exigirModulo("ocorrencias"), exigirTela("ocorrencias")];

export async function contextoDaEmpresa(request: FastifyRequest): Promise<ContextoOcorrencias> {
  const { empresa } = await empresaDaRequisicao(request);
  return { empresaId: empresa.id, fuso: empresa.fuso };
}

/** Tela Ocorrências: só leitura, para quem tem a tela e o módulo. */
export const rotasOcorrencias: FastifyPluginCallbackZod<{ agora: () => Date }> = (
  app,
  { agora },
  pronto,
) => {
  app.post(
    c.painel.caminho,
    { schema: { body: c.painel.entrada, response: { 200: c.painel.saida } }, preHandler: ler },
    async (request) =>
      obterPainel(request.db, await contextoDaEmpresa(request), request.body, agora()),
  );

  app.post(
    c.lista.caminho,
    { schema: { body: c.lista.entrada, response: { 200: c.lista.saida } }, preHandler: ler },
    async (request) =>
      obterLista(request.db, await contextoDaEmpresa(request), request.body, agora()),
  );

  app.post(
    c.codigosDoCard.caminho,
    {
      schema: { body: c.codigosDoCard.entrada, response: { 200: c.codigosDoCard.saida } },
      preHandler: ler,
    },
    async (request) =>
      obterCodigosDoCard(request.db, await contextoDaEmpresa(request), request.body, agora()),
  );

  app.post(
    c.opcoes.caminho,
    { schema: { body: c.opcoes.entrada, response: { 200: c.opcoes.saida } }, preHandler: ler },
    async (request) => obterOpcoes(request.db, await contextoDaEmpresa(request), request.body),
  );

  app.get(
    c.conferentes.caminho,
    { schema: { response: { 200: c.conferentes.saida } }, preHandler: ler },
    async (request) => listarConferentes(request.db, await contextoDaEmpresa(request)),
  );
  pronto();
};
