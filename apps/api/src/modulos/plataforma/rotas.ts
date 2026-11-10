import { type ChavesDeSegredo } from "@erp/db/segredos";
import { contratosPlataforma as c } from "@erp/shared/contratos/plataforma";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { executorDePlataforma } from "../../http/contexto";
import { exigirAdminPlataforma } from "../../http/guardas";
import { type Armazenamento } from "../../infra/armazenamento";
import { atorDa } from "../../plugins/sessao";
import { type ExecutorComContexto } from "../../repositorios";
import { listarCargos, listarDepartamentos } from "../cadastros/casos-de-uso";
import { convidarParaEmpresa, type DependenciasUsuarios } from "../usuarios/casos-de-uso";
import {
  adicionarAdmin,
  criarEmpresa,
  definirSegredo,
  enviarLogo,
  listarAdmins,
  listarEmpresas,
  listarIntegracoes,
  listarModulos,
  listarVinculos,
  obterEmpresa,
  removerAdmin,
  removerLogo,
  salvarEmpresa,
  salvarIntegracao,
  salvarModulo,
  salvarVinculo,
} from "./casos-de-uso";

export interface OpcoesRotasPlataforma {
  executar: ExecutorComContexto;
  usuarios: DependenciasUsuarios;
  armazenamento: Armazenamento | null;
  chavesDeSegredo: ChavesDeSegredo | null;
  urlDoLogo: (caminho: string | null) => string | null;
  agora: () => Date;
}

const ok = { ok: true as const };
/** O logo vem em base64 no corpo: limite próprio, um pouco acima de 512 KB codificados. */
const LIMITE_DO_CORPO_DO_LOGO = 750_000;

/** Tudo aqui é só da equipe da Plataforma (o guard roda antes de qualquer leitura). */
export const rotasPlataforma: FastifyPluginCallbackZod<OpcoesRotasPlataforma> = (
  app,
  opcoes,
  pronto,
) => {
  const { executar } = opcoes;
  const naEmpresa = (request: FastifyRequest) => (empresaId: string | null) =>
    executorDePlataforma(executar, request, empresaId);
  const preHandler = exigirAdminPlataforma;

  app.get(
    c.listarEmpresas.caminho,
    { schema: { response: { 200: c.listarEmpresas.saida } }, preHandler },
    async (request) => ({
      empresas: await listarEmpresas(naEmpresa(request)(null), opcoes.agora()),
    }),
  );

  app.post(
    c.criarEmpresa.caminho,
    {
      schema: { body: c.criarEmpresa.entrada, response: { 200: c.criarEmpresa.saida } },
      preHandler,
    },
    async (request) => criarEmpresa(naEmpresa(request), await atorDa(request), request.body),
  );

  app.get(
    c.obterEmpresa.caminho,
    {
      schema: { params: c.obterEmpresa.parametros, response: { 200: c.obterEmpresa.saida } },
      preHandler,
    },
    async (request) =>
      obterEmpresa(naEmpresa(request)(request.params.id), opcoes.urlDoLogo, request.params.id),
  );

  app.put(
    c.salvarEmpresa.caminho,
    {
      schema: {
        params: c.salvarEmpresa.parametros,
        body: c.salvarEmpresa.entrada,
        response: { 200: c.salvarEmpresa.saida },
      },
      preHandler,
    },
    async (request) => {
      const { id } = request.params;
      await salvarEmpresa(naEmpresa(request)(id), await atorDa(request), id, request.body);
      return ok;
    },
  );

  const depsDoLogo = (request: FastifyRequest) => ({
    armazenamento: opcoes.armazenamento,
    urlDoLogo: opcoes.urlDoLogo,
    agora: opcoes.agora,
    log: request.log,
  });

  app.put(
    c.enviarLogo.caminho,
    {
      schema: {
        params: c.enviarLogo.parametros,
        body: c.enviarLogo.entrada,
        response: { 200: c.enviarLogo.saida },
      },
      bodyLimit: LIMITE_DO_CORPO_DO_LOGO,
      preHandler,
    },
    async (request) => {
      const { id } = request.params;
      return enviarLogo(
        depsDoLogo(request),
        naEmpresa(request)(id),
        await atorDa(request),
        id,
        request.body.conteudoBase64,
      );
    },
  );

  app.delete(
    c.removerLogo.caminho,
    {
      schema: { params: c.removerLogo.parametros, response: { 200: c.removerLogo.saida } },
      preHandler,
    },
    async (request) => {
      const { id } = request.params;
      await removerLogo(depsDoLogo(request), naEmpresa(request)(id), await atorDa(request), id);
      return ok;
    },
  );

  app.get(
    c.listarModulos.caminho,
    {
      schema: { params: c.listarModulos.parametros, response: { 200: c.listarModulos.saida } },
      preHandler,
    },
    async (request) => ({
      modulos: await listarModulos(naEmpresa(request)(request.params.id), request.params.id),
    }),
  );

  app.put(
    c.salvarModulo.caminho,
    {
      schema: {
        params: c.salvarModulo.parametros,
        body: c.salvarModulo.entrada,
        response: { 200: c.salvarModulo.saida },
      },
      preHandler,
    },
    async (request) => {
      const { id, modulo } = request.params;
      await salvarModulo(naEmpresa(request)(id), await atorDa(request), id, modulo, request.body);
      return ok;
    },
  );

  app.get(
    c.listarUsuarios.caminho,
    {
      schema: { params: c.listarUsuarios.parametros, response: { 200: c.listarUsuarios.saida } },
      preHandler,
    },
    async (request) => ({
      usuarios: await listarVinculos(naEmpresa(request)(request.params.id), request.params.id),
    }),
  );

  app.post(
    c.convidarUsuario.caminho,
    {
      schema: {
        params: c.convidarUsuario.parametros,
        body: c.convidarUsuario.entrada,
        response: { 200: c.convidarUsuario.saida },
      },
      preHandler,
    },
    async (request) => {
      const { id } = request.params;
      const db = naEmpresa(request)(id);
      const empresa = await obterEmpresa(db, opcoes.urlDoLogo, id);
      return convidarParaEmpresa(
        opcoes.usuarios,
        db,
        { empresaId: id, empresaNome: empresa.nome, papel: null, plataforma: true },
        await atorDa(request),
        request.body,
      );
    },
  );

  app.put(
    c.salvarVinculo.caminho,
    {
      schema: {
        params: c.salvarVinculo.parametros,
        body: c.salvarVinculo.entrada,
        response: { 200: c.salvarVinculo.saida },
      },
      preHandler,
    },
    async (request) => {
      const { id, usuarioId } = request.params;
      await salvarVinculo(
        naEmpresa(request)(id),
        await atorDa(request),
        id,
        usuarioId,
        request.body,
      );
      return ok;
    },
  );

  app.get(
    c.cadastrosDaEmpresa.caminho,
    {
      schema: {
        params: c.cadastrosDaEmpresa.parametros,
        response: { 200: c.cadastrosDaEmpresa.saida },
      },
      preHandler,
    },
    async (request) => {
      const { id } = request.params;
      const db = naEmpresa(request)(id);
      await obterEmpresa(db, opcoes.urlDoLogo, id);
      return {
        cargos: await listarCargos(db, id),
        departamentos: await listarDepartamentos(db, id),
      };
    },
  );

  app.get(
    c.listarIntegracoes.caminho,
    {
      schema: {
        params: c.listarIntegracoes.parametros,
        response: { 200: c.listarIntegracoes.saida },
      },
      preHandler,
    },
    async (request) => ({
      integracoes: await listarIntegracoes(
        naEmpresa(request)(request.params.id),
        request.params.id,
      ),
    }),
  );

  app.put(
    c.salvarIntegracao.caminho,
    {
      schema: {
        params: c.salvarIntegracao.parametros,
        body: c.salvarIntegracao.entrada,
        response: { 200: c.salvarIntegracao.saida },
      },
      preHandler,
    },
    async (request) => {
      const { id, tipo } = request.params;
      await salvarIntegracao(naEmpresa(request)(id), await atorDa(request), id, tipo, request.body);
      return ok;
    },
  );

  app.put(
    c.definirSegredo.caminho,
    {
      schema: {
        params: c.definirSegredo.parametros,
        body: c.definirSegredo.entrada,
        response: { 200: c.definirSegredo.saida },
      },
      preHandler,
    },
    async (request) => {
      const { id, tipo } = request.params;
      return definirSegredo(
        opcoes.chavesDeSegredo,
        naEmpresa(request)(id),
        await atorDa(request),
        id,
        tipo,
        request.body.segredo,
        opcoes.agora(),
      );
    },
  );

  app.get(
    c.listarAdmins.caminho,
    { schema: { response: { 200: c.listarAdmins.saida } }, preHandler },
    async (request) => ({ admins: await listarAdmins(naEmpresa(request)(null)) }),
  );

  app.post(
    c.adicionarAdmin.caminho,
    {
      schema: { body: c.adicionarAdmin.entrada, response: { 200: c.adicionarAdmin.saida } },
      preHandler,
    },
    async (request) => {
      await adicionarAdmin(naEmpresa(request)(null), await atorDa(request), request.body.email);
      return ok;
    },
  );

  app.delete(
    c.removerAdmin.caminho,
    {
      schema: { params: c.removerAdmin.parametros, response: { 200: c.removerAdmin.saida } },
      preHandler,
    },
    async (request) => {
      await removerAdmin(naEmpresa(request)(null), await atorDa(request), request.params.usuarioId);
      return ok;
    },
  );
  pronto();
};
