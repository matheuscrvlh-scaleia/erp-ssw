import { contratosColetas as c } from "@erp/shared/contratos/coletas";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { empresaDaRequisicao } from "../../http/contexto";
import { exigirModulo, exigirPermissao } from "../../http/guardas";
import {
  type ContextoColetas,
  exportarListaDeColetas,
  importarRelatorio050,
  obterDetalheDaColeta,
  obterListaDeColetas,
  obterPainelDeColetas,
} from "./casos-de-uso";

/** Tela Coletas: todas as unidades da empresa para quem tem a tela (decisão de 05/11). */
const ler = [exigirModulo("coletas"), exigirPermissao("coletas", "ver")];
/** Importação manual do 050: admin da empresa, com o módulo. */
const importar = [exigirModulo("coletas"), exigirPermissao("coletas", "editar")];

/**
 * O 050 chega inteiro no corpo: até 30 milhões de caracteres ISO-8859-1, que em JSON (UTF-8)
 * podem ocupar o dobro.
 */
const LIMITE_DO_CORPO_DO_050 = 64 * 1024 * 1024;

async function contextoDe(request: FastifyRequest): Promise<ContextoColetas> {
  const { empresa } = await empresaDaRequisicao(request);
  return { empresaId: empresa.id, fuso: empresa.fuso };
}

export const rotasColetas: FastifyPluginCallbackZod<{ agora: () => Date }> = (
  app,
  { agora },
  pronto,
) => {
  app.post(
    c.painel.caminho,
    { schema: { body: c.painel.entrada, response: { 200: c.painel.saida } }, preHandler: ler },
    async (request) =>
      obterPainelDeColetas(request.db, await contextoDe(request), request.body, agora()),
  );

  app.post(
    c.lista.caminho,
    { schema: { body: c.lista.entrada, response: { 200: c.lista.saida } }, preHandler: ler },
    async (request) =>
      obterListaDeColetas(request.db, await contextoDe(request), request.body, agora()),
  );

  app.post(
    c.exportar.caminho,
    {
      schema: { body: c.exportar.entrada, response: { 200: c.exportar.saida } },
      preHandler: ler,
    },
    async (request) =>
      exportarListaDeColetas(request.db, await contextoDe(request), request.body, agora()),
  );

  app.get(
    c.detalhe.caminho,
    {
      schema: { params: c.detalhe.parametros, response: { 200: c.detalhe.saida } },
      preHandler: ler,
    },
    async (request) =>
      obterDetalheDaColeta(
        request.db,
        await contextoDe(request),
        request.params.unidade,
        request.params.numero,
      ),
  );

  app.post(
    c.importar050.caminho,
    {
      schema: { body: c.importar050.entrada, response: { 200: c.importar050.saida } },
      preHandler: importar,
      bodyLimit: LIMITE_DO_CORPO_DO_050,
    },
    async (request) =>
      importarRelatorio050(request.db, await contextoDe(request), request.body, agora()),
  );
  pronto();
};
