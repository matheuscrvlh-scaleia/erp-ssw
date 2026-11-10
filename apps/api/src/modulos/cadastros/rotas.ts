import { contratosAdmin as c } from "@erp/shared/contratos/admin";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { empresaDaRequisicao } from "../../http/contexto";
import { exigirAdminDaEmpresa, exigirTela, exigirUmaDasTelas } from "../../http/guardas";
import { atorDa } from "../../plugins/sessao";
import {
  alterarCargo,
  alterarDepartamento,
  criarCargo,
  criarDepartamento,
  excluirCargo,
  excluirDepartamento,
  listarCargos,
  listarDepartamentos,
} from "./casos-de-uso";

/*
 * Cargos e departamentos da empresa ativa (Q30: cada empresa edita os seus). Ler: admin com a
 * tela do cadastro ou de Usuários (que mostra as opções). Gravar: admin com a tela do cadastro.
 */
const lerCadastro = [
  exigirAdminDaEmpresa,
  exigirUmaDasTelas("admin_roles", "admin_departamentos", "admin_usuarios"),
];
const gravarCargo = [exigirAdminDaEmpresa, exigirTela("admin_roles")];
const gravarDepartamento = [exigirAdminDaEmpresa, exigirTela("admin_departamentos")];
const ok = { ok: true as const };

export const rotasCadastros: FastifyPluginCallbackZod = (app, _opcoes, pronto) => {
  app.get(
    c.listarCargos.caminho,
    { schema: { response: { 200: c.listarCargos.saida } }, preHandler: lerCadastro },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      return { cargos: await listarCargos(request.db, empresa.id) };
    },
  );

  app.post(
    c.criarCargo.caminho,
    {
      schema: { body: c.criarCargo.entrada, response: { 200: c.criarCargo.saida } },
      preHandler: gravarCargo,
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
      preHandler: gravarCargo,
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
      preHandler: gravarCargo,
    },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      await excluirCargo(request.db, empresa.id, await atorDa(request), request.params.chave);
      return ok;
    },
  );

  app.get(
    c.listarDepartamentos.caminho,
    { schema: { response: { 200: c.listarDepartamentos.saida } }, preHandler: lerCadastro },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      return { departamentos: await listarDepartamentos(request.db, empresa.id) };
    },
  );

  app.post(
    c.criarDepartamento.caminho,
    {
      schema: { body: c.criarDepartamento.entrada, response: { 200: c.criarDepartamento.saida } },
      preHandler: gravarDepartamento,
    },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      await criarDepartamento(request.db, empresa.id, await atorDa(request), request.body);
      return ok;
    },
  );

  app.put(
    c.alterarDepartamento.caminho,
    {
      schema: {
        params: c.alterarDepartamento.parametros,
        body: c.alterarDepartamento.entrada,
        response: { 200: c.alterarDepartamento.saida },
      },
      preHandler: gravarDepartamento,
    },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      await alterarDepartamento(
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
    c.excluirDepartamento.caminho,
    {
      schema: {
        params: c.excluirDepartamento.parametros,
        response: { 200: c.excluirDepartamento.saida },
      },
      preHandler: gravarDepartamento,
    },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      await excluirDepartamento(
        request.db,
        empresa.id,
        await atorDa(request),
        request.params.chave,
      );
      return ok;
    },
  );
  pronto();
};
