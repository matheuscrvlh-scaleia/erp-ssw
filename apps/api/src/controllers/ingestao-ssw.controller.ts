import { contratosIngestaoSsw as c } from "@erp/shared/contratos/ingestao-ssw";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import {
  atualizacaoDosDados,
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
} from "../models/ingestao-ssw/ingestao-ssw.service";
import {
  apresentarAtualizacaoDosDados,
  apresentarCredenciaisSsw,
  apresentarDiagnosticoSsw,
  apresentarEventosWebhook,
  apresentarRodadaDoBi2,
  apresentarStatusBi2,
} from "../views/ingestao-ssw.view";
import { empresaDaRequisicao } from "./middleware/contexto";
import { exigirAdminPlataforma, exigirEmpresa, exigirPermissao } from "./middleware/guardas";
import { atorDa } from "./middleware/sessao";

/**
 * Faixa de saúde: todo usuário com empresa. Ingestão SSW e Diagnóstico SSW: só a Plataforma, na
 * empresa ativa (decisão de 09/11: telas de integração são da Plataforma).
 */
const ingestao = [exigirPermissao("admin_ingestao", "ver"), exigirAdminPlataforma];
const editarIngestao = [exigirPermissao("admin_ingestao", "editar"), exigirAdminPlataforma];
const diagnostico = [exigirPermissao("admin_ssw_diagnostico", "ver"), exigirAdminPlataforma];
const reprocessar = [exigirPermissao("admin_ssw_diagnostico", "editar"), exigirAdminPlataforma];

export const controladorIngestaoSsw: FastifyPluginCallbackZod<{ deps: DependenciasIngestaoSsw }> = (
  app,
  { deps },
  pronto,
) => {
  const empresa = async (request: Parameters<typeof empresaDaRequisicao>[0]) =>
    (await empresaDaRequisicao(request)).empresa.id;

  app.get(
    c.atualizacao.caminho,
    { schema: { response: { 200: c.atualizacao.saida } }, preHandler: [exigirEmpresa] },
    async (request) =>
      apresentarAtualizacaoDosDados(
        await atualizacaoDosDados(request.db, (await request.acesso()).adminPlataforma),
      ),
  );

  app.get(
    c.saude.caminho,
    { schema: { response: { 200: c.saude.saida } }, preHandler: [exigirEmpresa] },
    async (request) => saudeSsw(request.db, deps, await empresa(request)),
  );

  app.get(
    c.bi2Status.caminho,
    { schema: { response: { 200: c.bi2Status.saida } }, preHandler: ingestao },
    async (request) => apresentarStatusBi2(await statusBi2(request.db)),
  );

  app.post(
    c.rodarBi2.caminho,
    {
      schema: { body: c.rodarBi2.entrada, response: { 200: c.rodarBi2.saida } },
      preHandler: editarIngestao,
    },
    async (request) =>
      apresentarRodadaDoBi2(
        await rodarBi2(
          request.db,
          deps,
          await atorDa(request),
          await empresa(request),
          request.body.data,
        ),
      ),
  );

  app.get(
    c.credenciais.caminho,
    { schema: { response: { 200: c.credenciais.saida } }, preHandler: ingestao },
    async (request) =>
      apresentarCredenciaisSsw(await credenciaisSsw(request.db, deps, await empresa(request))),
  );

  app.put(
    c.salvarCredenciais.caminho,
    {
      schema: { body: c.salvarCredenciais.entrada, response: { 200: c.salvarCredenciais.saida } },
      preHandler: editarIngestao,
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
    { schema: { response: { 200: c.testarConexao.saida } }, preHandler: editarIngestao },
    async (request) => testarConexaoSsw(deps, await empresa(request)),
  );

  app.get(
    c.eventosWebhook.caminho,
    { schema: { response: { 200: c.eventosWebhook.saida } }, preHandler: ingestao },
    async (request) => apresentarEventosWebhook(await eventosWebhook(request.db)),
  );

  app.post(
    c.reprocessarEvento.caminho,
    {
      schema: {
        params: c.reprocessarEvento.parametros,
        response: { 200: c.reprocessarEvento.saida },
      },
      preHandler: editarIngestao,
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
    async (request) =>
      apresentarDiagnosticoSsw(await diagnosticoSsw(request.db, deps, await empresa(request))),
  );

  app.post(
    c.reprocessarTokenIncorreto.caminho,
    { schema: { response: { 200: c.reprocessarTokenIncorreto.saida } }, preHandler: reprocessar },
    async (request) =>
      reprocessarTokenIncorreto(request.db, deps, await atorDa(request), await empresa(request)),
  );

  pronto();
};
