import { contratosAdmin as c } from "@erp/shared/contratos/admin";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { empresaDaRequisicao, executorDePlataforma } from "../../http/contexto";
import { exigirAdminDaEmpresa, exigirTela } from "../../http/guardas";
import { atorDa } from "../../plugins/sessao";
import { type ExecutorComContexto } from "../../repositorios";
import {
  alterarUsuario,
  type ContextoUsuarios,
  criarUsuario,
  definirSenha,
  type DependenciasUsuarios,
  listarUsuarios,
  reenviarConvite,
} from "./casos-de-uso";

/** Admin › Usuários: admin da empresa ativa (ou Plataforma) com a tela. Sem módulo (essencial). */
const admin = [exigirAdminDaEmpresa, exigirTela("admin_usuarios")];

export async function contextoDeUsuarios(request: FastifyRequest): Promise<ContextoUsuarios> {
  const { acesso, empresa } = await empresaDaRequisicao(request);
  return {
    empresaId: empresa.id,
    empresaNome: empresa.nome,
    papel: acesso.papel,
    plataforma: acesso.adminPlataforma,
  };
}

export interface OpcoesRotasUsuarios {
  deps: DependenciasUsuarios;
  executar: ExecutorComContexto;
}

export const rotasUsuarios: FastifyPluginCallbackZod<OpcoesRotasUsuarios> = (
  app,
  { deps, executar },
  pronto,
) => {
  app.get(
    c.listarUsuarios.caminho,
    { schema: { response: { 200: c.listarUsuarios.saida } }, preHandler: admin },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      return { usuarios: await listarUsuarios(request.db, empresa.id) };
    },
  );

  app.post(
    c.criarUsuario.caminho,
    {
      schema: { body: c.criarUsuario.entrada, response: { 200: c.criarUsuario.saida } },
      preHandler: admin,
    },
    async (request) =>
      criarUsuario(
        deps,
        request.db,
        await contextoDeUsuarios(request),
        await atorDa(request),
        request.body,
      ),
  );

  app.put(
    c.alterarUsuario.caminho,
    {
      schema: {
        params: c.alterarUsuario.parametros,
        body: c.alterarUsuario.entrada,
        response: { 200: c.alterarUsuario.saida },
      },
      preHandler: admin,
    },
    async (request) => {
      await alterarUsuario(
        request.db,
        executorDePlataforma(executar, request, null),
        await contextoDeUsuarios(request),
        await atorDa(request),
        request.params.id,
        request.body,
      );
      return { ok: true as const };
    },
  );

  app.post(
    c.reenviarConvite.caminho,
    {
      schema: { params: c.reenviarConvite.parametros, response: { 200: c.reenviarConvite.saida } },
      preHandler: admin,
    },
    async (request) => {
      await reenviarConvite(
        deps,
        request.db,
        await contextoDeUsuarios(request),
        await atorDa(request),
        request.params.id,
      );
      return { ok: true as const };
    },
  );

  app.put(
    c.definirSenha.caminho,
    {
      schema: {
        params: c.definirSenha.parametros,
        body: c.definirSenha.entrada,
        response: { 200: c.definirSenha.saida },
      },
      preHandler: admin,
    },
    async (request) => {
      await definirSenha(
        deps,
        request.db,
        executorDePlataforma(executar, request, null),
        await contextoDeUsuarios(request),
        await atorDa(request),
        request.params.id,
        request.body.senha,
      );
      return { ok: true as const };
    },
  );
  pronto();
};
