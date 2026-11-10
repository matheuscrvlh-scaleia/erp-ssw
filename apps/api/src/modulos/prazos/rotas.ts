import { contratosAdmin as c } from "@erp/shared/contratos/admin";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { empresaDaRequisicao } from "../../http/contexto";
import { exigirAdminDaEmpresa, exigirTela } from "../../http/guardas";
import { type FilaDeJobs } from "../../infra/fila";
import { atorDa } from "../../plugins/sessao";
import { alterarPrazo, criarPrazo, excluirPrazo, ligarPrazo, listarPrazos } from "./casos-de-uso";

/** Prazos configurados ficam em Admin › Configurações: admin com a tela, sem módulo. */
const admin = [exigirAdminDaEmpresa, exigirTela("admin_configuracoes")];

export const rotasPrazos: FastifyPluginCallbackZod<{ fila: FilaDeJobs }> = (
  app,
  { fila },
  pronto,
) => {
  app.get(
    c.listarPrazos.caminho,
    { schema: { response: { 200: c.listarPrazos.saida } }, preHandler: admin },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      return listarPrazos(request.db, empresa.id);
    },
  );

  app.post(
    c.criarPrazo.caminho,
    {
      schema: { body: c.criarPrazo.entrada, response: { 200: c.criarPrazo.saida } },
      preHandler: admin,
    },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      return criarPrazo(request.db, fila, empresa.id, await atorDa(request), request.body);
    },
  );

  app.put(
    c.alterarPrazo.caminho,
    {
      schema: {
        params: c.alterarPrazo.parametros,
        body: c.alterarPrazo.entrada,
        response: { 200: c.alterarPrazo.saida },
      },
      preHandler: admin,
    },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      return alterarPrazo(
        request.db,
        fila,
        empresa.id,
        await atorDa(request),
        request.params.id,
        request.body,
      );
    },
  );

  app.patch(
    c.ligarPrazo.caminho,
    {
      schema: {
        params: c.ligarPrazo.parametros,
        body: c.ligarPrazo.entrada,
        response: { 200: c.ligarPrazo.saida },
      },
      preHandler: admin,
    },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      return ligarPrazo(
        request.db,
        fila,
        empresa.id,
        await atorDa(request),
        request.params.id,
        request.body.ativo,
      );
    },
  );

  app.delete(
    c.excluirPrazo.caminho,
    {
      schema: { params: c.excluirPrazo.parametros, response: { 200: c.excluirPrazo.saida } },
      preHandler: admin,
    },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      return excluirPrazo(request.db, fila, empresa.id, await atorDa(request), request.params.id);
    },
  );
  pronto();
};
