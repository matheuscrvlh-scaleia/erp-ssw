import { type ChavesDeSegredo } from "@erp/db/segredos";
import { contratosPlataforma as c } from "@erp/shared/contratos/plataforma";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { executorDePlataforma } from "../http/middleware/contexto";
import { exigirAdminPlataforma } from "../http/middleware/guardas";
import { atorDa } from "../http/middleware/sessao";
import type { Armazenamento } from "../infra/armazenamento";
import { type FonteDaConfiguracao } from "../infra/configuracao-da-plataforma";
import { type Correio } from "../infra/correio";
import { listarCargos } from "../models/cadastros/cadastros.service";
import {
  adicionarAdmin,
  criarEmpresa,
  definirSegredo,
  definirSegredoDaPlataforma,
  enviarLogo,
  listarAdmins,
  listarEmpresas,
  listarIntegracoes,
  listarIntegracoesDaPlataforma,
  listarModulos,
  listarPessoas,
  listarVinculos,
  obterEmpresa,
  removerAdmin,
  removerLogo,
  salvarEmpresa,
  salvarIntegracao,
  salvarIntegracaoDaPlataforma,
  salvarModulo,
  salvarVinculo,
  testarEmailDaPlataforma,
} from "../models/plataforma/plataforma.service";
import { type ExecutorComContexto } from "../models/repositorios";
import {
  convidarParaEmpresa,
  type DependenciasUsuarios,
} from "../models/usuarios/usuarios.service";

export interface OpcoesRotasPlataforma {
  executar: ExecutorComContexto;
  usuarios: DependenciasUsuarios;
  armazenamento: Armazenamento | null;
  chavesDeSegredo: ChavesDeSegredo | null;
  urlDoLogo: (caminho: string | null) => string | null;
  agora: () => Date;
  /** Configuração da Plataforma (domínio, e-mail, worker-ssw): a tela salva e limpa o cache. */
  configuracao: FonteDaConfiguracao;
  correio: Correio;
}

const ok = { ok: true as const };
/** O logo vem em base64 no corpo: limite próprio, um pouco acima de 512 KB codificados. */
const LIMITE_DO_CORPO_DO_LOGO = 750_000;

/** Tudo aqui é só da equipe da Plataforma (o guard roda antes de qualquer leitura). */
export const controladorPlataforma: FastifyPluginCallbackZod<OpcoesRotasPlataforma> = (
  app,
  opcoes,
  pronto,
) => {
  const { executar } = opcoes;
  const naEmpresa = (request: FastifyRequest) => (empresaId: string | null) =>
    executorDePlataforma(executar, request, empresaId);
  const onRequest = exigirAdminPlataforma;

  app.get(
    c.listarEmpresas.caminho,
    { schema: { response: { 200: c.listarEmpresas.saida } }, onRequest },
    async (request) => ({
      empresas: await listarEmpresas(naEmpresa(request)(null), opcoes.agora()),
    }),
  );

  app.post(
    c.criarEmpresa.caminho,
    {
      schema: { body: c.criarEmpresa.entrada, response: { 200: c.criarEmpresa.saida } },
      onRequest,
    },
    async (request) => criarEmpresa(naEmpresa(request), await atorDa(request), request.body),
  );

  app.get(
    c.obterEmpresa.caminho,
    {
      schema: { params: c.obterEmpresa.parametros, response: { 200: c.obterEmpresa.saida } },
      onRequest,
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
      onRequest,
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
      onRequest,
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
      onRequest,
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
      onRequest,
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
      onRequest,
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
      onRequest,
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
      onRequest,
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
      onRequest,
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
    c.cargosDaEmpresa.caminho,
    {
      schema: {
        params: c.cargosDaEmpresa.parametros,
        response: { 200: c.cargosDaEmpresa.saida },
      },
      onRequest,
    },
    async (request) => {
      const { id } = request.params;
      const db = naEmpresa(request)(id);
      await obterEmpresa(db, opcoes.urlDoLogo, id);
      return { cargos: await listarCargos(db, id) };
    },
  );

  app.get(
    c.listarIntegracoes.caminho,
    {
      schema: {
        params: c.listarIntegracoes.parametros,
        response: { 200: c.listarIntegracoes.saida },
      },
      onRequest,
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
      onRequest,
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
      onRequest,
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
    c.listarIntegracoesDaPlataforma.caminho,
    { schema: { response: { 200: c.listarIntegracoesDaPlataforma.saida } }, onRequest },
    async (request) => ({
      integracoes: await listarIntegracoesDaPlataforma(naEmpresa(request)(null)),
    }),
  );

  app.put(
    c.salvarIntegracaoDaPlataforma.caminho,
    {
      schema: {
        params: c.salvarIntegracaoDaPlataforma.parametros,
        body: c.salvarIntegracaoDaPlataforma.entrada,
        response: { 200: c.salvarIntegracaoDaPlataforma.saida },
      },
      onRequest,
    },
    async (request) => {
      await salvarIntegracaoDaPlataforma(
        naEmpresa(request)(null),
        await atorDa(request),
        request.params.tipo,
        request.body.parametros,
        () => {
          opcoes.configuracao.invalidar();
        },
      );
      return ok;
    },
  );

  app.put(
    c.definirSegredoDaPlataforma.caminho,
    {
      schema: {
        params: c.definirSegredoDaPlataforma.parametros,
        body: c.definirSegredoDaPlataforma.entrada,
        response: { 200: c.definirSegredoDaPlataforma.saida },
      },
      onRequest,
    },
    async (request) =>
      definirSegredoDaPlataforma(
        opcoes.chavesDeSegredo,
        naEmpresa(request)(null),
        await atorDa(request),
        request.params.tipo,
        request.body.segredo,
        opcoes.agora(),
        () => {
          opcoes.configuracao.invalidar();
        },
      ),
  );

  app.post(
    c.testarEmailDaPlataforma.caminho,
    {
      schema: {
        body: c.testarEmailDaPlataforma.entrada,
        response: { 200: c.testarEmailDaPlataforma.saida },
      },
      onRequest,
    },
    async (request) => {
      await testarEmailDaPlataforma(opcoes.correio, request.body.para);
      return ok;
    },
  );

  app.get(
    c.listarPessoas.caminho,
    { schema: { response: { 200: c.listarPessoas.saida } }, onRequest },
    async (request) => ({ pessoas: await listarPessoas(naEmpresa(request)(null)) }),
  );

  app.get(
    c.listarAdmins.caminho,
    { schema: { response: { 200: c.listarAdmins.saida } }, onRequest },
    async (request) => ({ admins: await listarAdmins(naEmpresa(request)(null)) }),
  );

  app.post(
    c.adicionarAdmin.caminho,
    {
      schema: { body: c.adicionarAdmin.entrada, response: { 200: c.adicionarAdmin.saida } },
      onRequest,
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
      onRequest,
    },
    async (request) => {
      await removerAdmin(naEmpresa(request)(null), await atorDa(request), request.params.usuarioId);
      return ok;
    },
  );
  pronto();
};
