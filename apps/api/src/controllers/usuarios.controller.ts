import { contratosAdmin as c } from "@erp/shared/contratos/admin";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { type ExecutorComContexto } from "../models/repositorios";
import {
  alterarUsuario,
  type ContextoUsuarios,
  criarUsuario,
  definirExcecoes,
  definirSenha,
  type DependenciasUsuarios,
  listarUsuarios,
  reenviarConvite,
} from "../models/usuarios/usuarios.service";
import { confirmacao } from "../views/comum.view";
import { apresentarUsuarios } from "../views/usuarios.view";
import { empresaDaRequisicao, executorDePlataforma } from "./middleware/contexto";
import { exigirAdminDaEmpresa, exigirPermissao } from "./middleware/guardas";
import { atorDa } from "./middleware/sessao";

/**
 * Usuários e cargos › Usuários: gerir acesso é do admin da empresa ativa (ou Plataforma), com a
 * ação na tela. Sem módulo (essencial).
 */
const ler = [exigirAdminDaEmpresa, exigirPermissao("admin_usuarios", "ver")];
const editar = [exigirAdminDaEmpresa, exigirPermissao("admin_usuarios", "editar")];

async function contextoDeUsuarios(request: FastifyRequest): Promise<ContextoUsuarios> {
  const { acesso, empresa } = await empresaDaRequisicao(request);
  return {
    empresaId: empresa.id,
    empresaNome: empresa.nome,
    papel: acesso.papel,
    plataforma: acesso.adminPlataforma,
  };
}

interface OpcoesRotasUsuarios {
  deps: DependenciasUsuarios;
  executar: ExecutorComContexto;
}

export const controladorUsuarios: FastifyPluginCallbackZod<OpcoesRotasUsuarios> = (
  app,
  { deps, executar },
  pronto,
) => {
  app.get(
    c.listarUsuarios.caminho,
    { schema: { response: { 200: c.listarUsuarios.saida } }, onRequest: ler },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      return apresentarUsuarios(await listarUsuarios(request.db, empresa.id));
    },
  );

  app.post(
    c.criarUsuario.caminho,
    {
      schema: { body: c.criarUsuario.entrada, response: { 200: c.criarUsuario.saida } },
      onRequest: editar,
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
      onRequest: editar,
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
      return confirmacao();
    },
  );

  app.put(
    c.definirExcecoes.caminho,
    {
      schema: {
        params: c.definirExcecoes.parametros,
        body: c.definirExcecoes.entrada,
        response: { 200: c.definirExcecoes.saida },
      },
      onRequest: editar,
    },
    async (request) => {
      await definirExcecoes(
        request.db,
        await contextoDeUsuarios(request),
        await atorDa(request),
        request.params.id,
        request.body.excecoes,
      );
      return confirmacao();
    },
  );

  app.post(
    c.reenviarConvite.caminho,
    {
      schema: { params: c.reenviarConvite.parametros, response: { 200: c.reenviarConvite.saida } },
      onRequest: editar,
    },
    async (request) => {
      await reenviarConvite(
        deps,
        request.db,
        await contextoDeUsuarios(request),
        await atorDa(request),
        request.params.id,
      );
      return confirmacao();
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
      onRequest: editar,
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
      return confirmacao();
    },
  );
  pronto();
};
