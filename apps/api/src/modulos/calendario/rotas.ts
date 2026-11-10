import { PAPEL_ADMIN, PAPEL_SUPER_ADMIN } from "@erp/shared/acesso/papeis";
import { contratosCalendario as c } from "@erp/shared/contratos/calendario";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { empresaDaRequisicao } from "../../http/contexto";
import { exigirAdminPlataforma, exigirModulo, exigirPapel, exigirTela } from "../../http/guardas";
import { atorDa } from "../../plugins/sessao";
import {
  alterarFeriado,
  type ContextoCalendario,
  criarFeriado,
  excluirFeriado,
  gerarNacionais,
  obterCalendario,
} from "./casos-de-uso";

/**
 * Ler: quem tem a tela; escrever: admin da empresa (ou Plataforma). Sempre com o módulo.
 * Gerar nacionais grava para todas as empresas: só a Plataforma (Q28 do dono).
 */
const ler = [exigirModulo("historico"), exigirTela("calendario")];
const escrever = [...ler, exigirPapel(PAPEL_ADMIN, PAPEL_SUPER_ADMIN)];
const gerarParaTodas = [...ler, exigirAdminPlataforma];

async function contextoDe(request: FastifyRequest): Promise<ContextoCalendario> {
  const { acesso, empresa } = await empresaDaRequisicao(request);
  return { empresaId: empresa.id, fuso: empresa.fuso, plataforma: acesso.adminPlataforma };
}

export const rotasCalendario: FastifyPluginCallbackZod<{ agora: () => Date }> = (
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
      obterCalendario(request.db, await contextoDe(request), request.query.ano, agora()),
  );

  app.post(
    c.criarFeriado.caminho,
    {
      schema: { body: c.criarFeriado.entrada, response: { 200: c.criarFeriado.saida } },
      preHandler: escrever,
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
      preHandler: escrever,
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
      preHandler: escrever,
    },
    async (request) => {
      await excluirFeriado(
        request.db,
        await contextoDe(request),
        await atorDa(request),
        request.params.id,
      );
      return { ok: true as const };
    },
  );

  app.post(
    c.gerarNacionais.caminho,
    {
      schema: { body: c.gerarNacionais.entrada, response: { 200: c.gerarNacionais.saida } },
      preHandler: gerarParaTodas,
    },
    async (request) =>
      gerarNacionais(request.db, await atorDa(request), request.body.ano, request.body.anosAFrente),
  );
  pronto();
};
