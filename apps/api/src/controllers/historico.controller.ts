import { contratosHistorico as c } from "@erp/shared/contratos/historico";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import {
  alterarFeriado,
  type ContextoCalendario,
  criarFeriado,
  excluirFeriado,
} from "../models/calendario/calendario.service";
import {
  alterarAnotacao,
  type ContextoHistorico,
  criarAnotacao,
  excluirAnotacao,
  importarNacionaisFixos,
  listarFeriados,
  obterHistorico,
} from "../models/historico/historico.service";
import { confirmacao } from "../views/comum.view";
import {
  apresentarFeriadoCriado,
  apresentarFeriados,
  apresentarHistorico,
} from "../views/historico.view";
import { empresaDaRequisicao } from "./middleware/contexto";
import { exigirModulo, exigirPermissao } from "./middleware/guardas";
import { atorDa } from "./middleware/sessao";

/** Histórico: quem tem a tela lê e anota (alterar/excluir é do autor ou do admin). */
const modulo = exigirModulo("historico");
const historico = [modulo, exigirPermissao("historico", "ver")];
/** Anotação: escreve quem tem a ação; mexer na de outra pessoa é só do admin (domínio). */
const anotar = [modulo, exigirPermissao("historico", "editar")];
const apagarAnotacao = [modulo, exigirPermissao("historico", "excluir")];
const feriados = [modulo, exigirPermissao("admin_historico", "ver")];
const editarFeriado = [modulo, exigirPermissao("admin_historico", "editar")];
const apagarFeriado = [modulo, exigirPermissao("admin_historico", "excluir")];

async function contextoDe(request: FastifyRequest): Promise<ContextoHistorico> {
  const { acesso, empresa } = await empresaDaRequisicao(request);
  return { empresaId: empresa.id, usuarioId: acesso.usuario.id, papel: acesso.papel };
}

async function contextoDoCalendario(request: FastifyRequest): Promise<ContextoCalendario> {
  const { acesso, empresa } = await empresaDaRequisicao(request);
  return { empresaId: empresa.id, fuso: empresa.fuso, plataforma: acesso.adminPlataforma };
}

export const controladorHistorico: FastifyPluginCallbackZod<{ agora: () => Date }> = (
  app,
  { agora },
  pronto,
) => {
  app.get(
    c.obter.caminho,
    {
      schema: { querystring: c.obter.entrada, response: { 200: c.obter.saida } },
      preHandler: historico,
    },
    async (request) =>
      apresentarHistorico(
        await obterHistorico(request.db, await contextoDe(request), request.query),
      ),
  );

  app.post(
    c.criarAnotacao.caminho,
    {
      schema: { body: c.criarAnotacao.entrada, response: { 200: c.criarAnotacao.saida } },
      preHandler: anotar,
    },
    async (request) =>
      criarAnotacao(request.db, await contextoDe(request), await atorDa(request), request.body),
  );

  app.put(
    c.alterarAnotacao.caminho,
    {
      schema: {
        params: c.alterarAnotacao.parametros,
        body: c.alterarAnotacao.entrada,
        response: { 200: c.alterarAnotacao.saida },
      },
      preHandler: anotar,
    },
    async (request) => {
      await alterarAnotacao(
        request.db,
        await contextoDe(request),
        await atorDa(request),
        request.params.id,
        request.body,
        agora(),
      );
      return confirmacao();
    },
  );

  app.delete(
    c.excluirAnotacao.caminho,
    {
      schema: { params: c.excluirAnotacao.parametros, response: { 200: c.excluirAnotacao.saida } },
      preHandler: apagarAnotacao,
    },
    async (request) => {
      await excluirAnotacao(
        request.db,
        await contextoDe(request),
        await atorDa(request),
        request.params.id,
      );
      return confirmacao();
    },
  );

  app.get(
    c.listarFeriados.caminho,
    {
      schema: { querystring: c.listarFeriados.entrada, response: { 200: c.listarFeriados.saida } },
      preHandler: feriados,
    },
    async (request) =>
      apresentarFeriados(
        await listarFeriados(request.db, await contextoDe(request), request.query),
      ),
  );

  app.post(
    c.criarFeriado.caminho,
    {
      schema: { body: c.criarFeriado.entrada, response: { 200: c.criarFeriado.saida } },
      preHandler: editarFeriado,
    },
    async (request) =>
      apresentarFeriadoCriado(
        await criarFeriado(request.db, await contextoDoCalendario(request), await atorDa(request), {
          ...request.body,
          recorrente: false,
          anosAFrente: 0,
        }),
      ),
  );

  app.put(
    c.alterarFeriado.caminho,
    {
      schema: {
        params: c.alterarFeriado.parametros,
        body: c.alterarFeriado.entrada,
        response: { 200: c.alterarFeriado.saida },
      },
      preHandler: editarFeriado,
    },
    async (request) => {
      await alterarFeriado(
        request.db,
        await contextoDoCalendario(request),
        await atorDa(request),
        request.params.id,
        request.body,
      );
      return confirmacao();
    },
  );

  app.delete(
    c.excluirFeriado.caminho,
    {
      schema: { params: c.excluirFeriado.parametros, response: { 200: c.excluirFeriado.saida } },
      preHandler: apagarFeriado,
    },
    async (request) => {
      await excluirFeriado(
        request.db,
        await contextoDoCalendario(request),
        await atorDa(request),
        request.params.id,
      );
      return confirmacao();
    },
  );

  app.post(
    c.importarNacionais.caminho,
    {
      schema: {
        body: c.importarNacionais.entrada,
        response: { 200: c.importarNacionais.saida },
      },
      preHandler: editarFeriado,
    },
    async (request) =>
      importarNacionaisFixos(
        request.db,
        await contextoDe(request),
        await atorDa(request),
        request.body.ano,
      ),
  );
  pronto();
};
