import { contratosAdmin as c } from "@erp/shared/contratos/admin";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { empresaDaRequisicao } from "../../http/contexto";
import { exigirAdminDaEmpresa, exigirPermissao, exigirUmaDasTelas } from "../../http/guardas";
import { atorDa } from "../../plugins/sessao";
import { alterarCargo, criarCargo, excluirCargo, listarCargos } from "./casos-de-uso";

/*
 * Cargos da empresa ativa (Q30: cada empresa edita os seus). Gerir acesso é do admin da empresa:
 * ler pede a tela Cargos ou Usuários (que mostra as opções); gravar, a ação em Cargos.
 */
const ler = [exigirAdminDaEmpresa, exigirUmaDasTelas("admin_roles", "admin_usuarios")];
const editar = [exigirAdminDaEmpresa, exigirPermissao("admin_roles", "editar")];
const excluir = [exigirAdminDaEmpresa, exigirPermissao("admin_roles", "excluir")];
const ok = { ok: true as const };

export const rotasCadastros: FastifyPluginCallbackZod = (app, _opcoes, pronto) => {
  app.get(
    c.listarCargos.caminho,
    { schema: { response: { 200: c.listarCargos.saida } }, onRequest: ler },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      return { cargos: await listarCargos(request.db, empresa.id) };
    },
  );

  app.post(
    c.criarCargo.caminho,
    {
      schema: { body: c.criarCargo.entrada, response: { 200: c.criarCargo.saida } },
      onRequest: editar,
    },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      await criarCargo(request.db, empresa.id, await atorDa(request), request.body);
      return ok;
    },
  );

  app.put(
    c.alterarCargo.caminho,
    {
      schema: {
        params: c.alterarCargo.parametros,
        body: c.alterarCargo.entrada,
        response: { 200: c.alterarCargo.saida },
      },
      onRequest: editar,
    },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      await alterarCargo(
        request.db,
        empresa.id,
        await atorDa(request),
        request.params.chave,
        request.body,
      );
      return ok;
    },
  );

  app.delete(
    c.excluirCargo.caminho,
    {
      schema: { params: c.excluirCargo.parametros, response: { 200: c.excluirCargo.saida } },
      onRequest: excluir,
    },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      await excluirCargo(request.db, empresa.id, await atorDa(request), request.params.chave);
      return ok;
    },
  );
  pronto();
};
