import { contratosIngestaoSsw as c } from "@erp/shared/contratos/ingestao-ssw";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { empresaDaRequisicao } from "../../http/contexto";
import { exigirAdminPlataforma, exigirEmpresa, exigirTela } from "../../http/guardas";
import { atorDa } from "../../plugins/sessao";
import {
  credenciaisSsw,
  type DependenciasIngestaoSsw,
  diagnosticoSsw,
  eventosWebhook,
  reprocessarEvento,
  reprocessarTokenIncorreto,
  rodarBi2,
  salvarCredenciaisSsw,
  saudeSsw,
  statusBi2,
  testarConexaoSsw,
} from "./casos-de-uso";

/**
 * Faixa de saúde: todo usuário com empresa. Ingestão SSW e Diagnóstico SSW: só a Plataforma, na
 * empresa ativa (decisão de 09/11: telas de integração são da Plataforma).
 */
const ingestao = [exigirTela("admin_ingestao"), exigirAdminPlataforma];
const diagnostico = [exigirTela("admin_ssw_diagnostico"), exigirAdminPlataforma];

export const rotasIngestaoSsw: FastifyPluginCallbackZod<{ deps: DependenciasIngestaoSsw }> = (
  app,
  { deps },
  pronto,
) => {
  const empresa = async (request: Parameters<typeof empresaDaRequisicao>[0]) =>
    (await empresaDaRequisicao(request)).empresa.id;

  app.get(
    c.saude.caminho,
    { schema: { response: { 200: c.saude.saida } }, preHandler: [exigirEmpresa] },
    async (request) => saudeSsw(request.db, deps, await empresa(request)),
  );

  app.get(
    c.bi2Status.caminho,
    { schema: { response: { 200: c.bi2Status.saida } }, preHandler: ingestao },
    async (request) => statusBi2(request.db),
  );

  app.post(
    c.rodarBi2.caminho,
    {
      schema: { body: c.rodarBi2.entrada, response: { 200: c.rodarBi2.saida } },
      preHandler: ingestao,
    },
    async (request) =>
      rodarBi2(request.db, deps, await atorDa(request), await empresa(request), request.body.data),
  );

  app.get(
    c.credenciais.caminho,
    { schema: { response: { 200: c.credenciais.saida } }, preHandler: ingestao },
    async (request) => credenciaisSsw(request.db, deps, await empresa(request)),
  );

  app.put(
    c.salvarCredenciais.caminho,
    {
      schema: { body: c.salvarCredenciais.entrada, response: { 200: c.salvarCredenciais.saida } },
      preHandler: ingestao,
    },
    async (request) =>
      salvarCredenciaisSsw(
        request.db,
        deps,
        await atorDa(request),
        await empresa(request),
        request.body,
      ),
  );

  app.post(
    c.testarConexao.caminho,
    { schema: { response: { 200: c.testarConexao.saida } }, preHandler: ingestao },
    async (request) => testarConexaoSsw(deps, await empresa(request)),
  );

  app.get(
    c.eventosWebhook.caminho,
    { schema: { response: { 200: c.eventosWebhook.saida } }, preHandler: ingestao },
    async (request) => eventosWebhook(request.db),
  );

  app.post(
    c.reprocessarEvento.caminho,
    {
      schema: {
        params: c.reprocessarEvento.parametros,
        response: { 200: c.reprocessarEvento.saida },
      },
      preHandler: ingestao,
    },
    async (request) =>
      reprocessarEvento(
        request.db,
        deps,
        await atorDa(request),
        await empresa(request),
        request.params.id,
      ),
  );

  app.get(
    c.diagnostico.caminho,
    { schema: { response: { 200: c.diagnostico.saida } }, preHandler: diagnostico },
    async (request) => diagnosticoSsw(request.db, deps, await empresa(request)),
  );

  app.post(
    c.reprocessarTokenIncorreto.caminho,
    { schema: { response: { 200: c.reprocessarTokenIncorreto.saida } }, preHandler: diagnostico },
    async (request) =>
      reprocessarTokenIncorreto(request.db, deps, await atorDa(request), await empresa(request)),
  );

  pronto();
};
