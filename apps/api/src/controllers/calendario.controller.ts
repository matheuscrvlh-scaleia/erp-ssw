import { type Acao } from "@erp/shared/acesso/permissoes";
import { contratosCalendario as c } from "@erp/shared/contratos/calendario";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import {
  alterarFeriado,
  type ContextoCalendario,
  criarFeriado,
  ESCOPO_GERAL,
  excluirFeriado,
  gerarNacionais,
  listarFeriadosGerais,
  obterCalendario,
} from "../models/calendario/calendario.service";
import { apresentarCalendario, apresentarFeriadosGerais } from "../views/calendario.view";
import { confirmacao } from "../views/comum.view";
import { empresaDaRequisicao } from "./middleware/contexto";
import { exigirModulo, exigirPermissao, exigirPermissaoDaPlataforma } from "./middleware/guardas";
import { atorDa } from "./middleware/sessao";

/**
 * Ler, criar/alterar e excluir pela permissão da tela Calendário. Sempre com o módulo.
 * Feriados gerais (gerar nacionais e Plataforma › Configurações) valem para todas as empresas:
 * só a Plataforma (Q28 do dono), sem depender dos módulos da empresa ativa.
 */
const modulo = exigirModulo("historico");
const ler = [modulo, exigirPermissao("calendario", "ver")];
const editar = [modulo, exigirPermissao("calendario", "editar")];
const excluir = [modulo, exigirPermissao("calendario", "excluir")];
const geral = (acao: Acao) => [exigirPermissaoDaPlataforma("plataforma_integracoes", acao)];

async function contextoDe(request: FastifyRequest): Promise<ContextoCalendario> {
  const { acesso, empresa } = await empresaDaRequisicao(request);
  return { empresaId: empresa.id, fuso: empresa.fuso, plataforma: acesso.adminPlataforma };
}

export const controladorCalendario: FastifyPluginCallbackZod<{ agora: () => Date }> = (
  app,
  { agora },
  pronto,
) => {
  app.get(
    c.obter.caminho,
    {
      schema: { querystring: c.obter.entrada, response: { 200: c.obter.saida } },
      preHandler: ler,
    },
    async (request) =>
      apresentarCalendario(
        await obterCalendario(request.db, await contextoDe(request), request.query.ano, agora()),
      ),
  );

  app.post(
    c.criarFeriado.caminho,
    {
      schema: { body: c.criarFeriado.entrada, response: { 200: c.criarFeriado.saida } },
      preHandler: editar,
    },
    async (request) =>
      criarFeriado(request.db, await contextoDe(request), await atorDa(request), request.body),
  );

  app.put(
    c.alterarFeriado.caminho,
    {
      schema: {
        params: c.alterarFeriado.parametros,
        body: c.alterarFeriado.entrada,
        response: { 200: c.alterarFeriado.saida },
      },
      preHandler: editar,
    },
    async (request) =>
      alterarFeriado(
        request.db,
        await contextoDe(request),
        await atorDa(request),
        request.params.id,
        request.body,
      ),
  );

  app.delete(
    c.excluirFeriado.caminho,
    {
      schema: { params: c.excluirFeriado.parametros, response: { 200: c.excluirFeriado.saida } },
      preHandler: excluir,
    },
    async (request) => {
      await excluirFeriado(
        request.db,
        await contextoDe(request),
        await atorDa(request),
        request.params.id,
      );
      return confirmacao();
    },
  );

  app.post(
    c.gerarNacionais.caminho,
    {
      schema: { body: c.gerarNacionais.entrada, response: { 200: c.gerarNacionais.saida } },
      preHandler: geral("editar"),
    },
    async (request) =>
      gerarNacionais(request.db, await atorDa(request), request.body.ano, request.body.anosAFrente),
  );

  app.get(
    c.listarFeriadosGerais.caminho,
    {
      schema: {
        querystring: c.listarFeriadosGerais.entrada,
        response: { 200: c.listarFeriadosGerais.saida },
      },
      preHandler: geral("ver"),
    },
    async (request) =>
      apresentarFeriadosGerais(await listarFeriadosGerais(request.db, request.query.ano)),
  );

  app.post(
    c.criarFeriadoGeral.caminho,
    {
      schema: { body: c.criarFeriadoGeral.entrada, response: { 200: c.criarFeriadoGeral.saida } },
      preHandler: geral("editar"),
    },
    async (request) => criarFeriado(request.db, ESCOPO_GERAL, await atorDa(request), request.body),
  );

  app.put(
    c.alterarFeriadoGeral.caminho,
    {
      schema: {
        params: c.alterarFeriadoGeral.parametros,
        body: c.alterarFeriadoGeral.entrada,
        response: { 200: c.alterarFeriadoGeral.saida },
      },
      preHandler: geral("editar"),
    },
    async (request) =>
      alterarFeriado(
        request.db,
        ESCOPO_GERAL,
        await atorDa(request),
        request.params.id,
        request.body,
      ),
  );

  app.delete(
    c.excluirFeriadoGeral.caminho,
    {
      schema: {
        params: c.excluirFeriadoGeral.parametros,
        response: { 200: c.excluirFeriadoGeral.saida },
      },
      preHandler: geral("editar"),
    },
    async (request) => {
      await excluirFeriado(request.db, ESCOPO_GERAL, await atorDa(request), request.params.id);
      return confirmacao();
    },
  );
  pronto();
};
