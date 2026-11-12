import { contratosAdmin as c } from "@erp/shared/contratos/admin";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import type { FilaDeJobs } from "../infra/fila";
import {
  alterarPrazo,
  criarPrazo,
  excluirPrazo,
  ligarPrazo,
  listarPrazos,
} from "../models/prazos/prazos.service";
import { apresentarPrazos } from "../views/prazos.view";
import { empresaDaRequisicao } from "./middleware/contexto";
import { exigirPermissao } from "./middleware/guardas";
import { atorDa } from "./middleware/sessao";

/** Prazos configurados ficam em Admin › Configurações: admin com a tela, sem módulo. */
const ler = exigirPermissao("admin_configuracoes", "ver");
const editar = exigirPermissao("admin_configuracoes", "editar");
const excluir = exigirPermissao("admin_configuracoes", "excluir");

export const controladorPrazos: FastifyPluginCallbackZod<{ fila: FilaDeJobs }> = (
  app,
  { fila },
  pronto,
) => {
  app.get(
    c.listarPrazos.caminho,
    { schema: { response: { 200: c.listarPrazos.saida } }, onRequest: ler },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      return apresentarPrazos(await listarPrazos(request.db, empresa.id));
    },
  );

  app.post(
    c.criarPrazo.caminho,
    {
      schema: { body: c.criarPrazo.entrada, response: { 200: c.criarPrazo.saida } },
      onRequest: editar,
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
      onRequest: editar,
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
      onRequest: editar,
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
      onRequest: excluir,
    },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      return excluirPrazo(request.db, fila, empresa.id, await atorDa(request), request.params.id);
    },
  );
  pronto();
};
