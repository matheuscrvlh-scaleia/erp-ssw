import { PAPEL_ADMIN, PAPEL_SUPER_ADMIN } from "@erp/shared/acesso/papeis";
import { contratosBonificacaoEntrega as c } from "@erp/shared/contratos/bonificacao-entrega";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { empresaDaRequisicao } from "../../http/contexto";
import { exigirModulo, exigirPapel, exigirTela } from "../../http/guardas";
import { atorDa } from "../../plugins/sessao";
import { clienteDaEmpresa, type DependenciasAhgora } from "../ahgora/casos-de-uso";
import {
  apurar,
  type ContextoBonificacao,
  excluirFalta,
  listarFaltas,
  listarParametros,
  listarUnidades,
  registrarFalta,
} from "./casos-de-uso";

/** Tudo é do admin da empresa (gestor vê a tela com exceção, mas o servidor nega — igual a hoje). */
const soAdmin = [
  exigirModulo("ponto_bonificacao"),
  exigirTela("admin_bonificacao_entrega"),
  exigirPapel(PAPEL_ADMIN, PAPEL_SUPER_ADMIN),
];

async function contextoDe(request: FastifyRequest): Promise<ContextoBonificacao> {
  const { empresa } = await empresaDaRequisicao(request);
  return { empresaId: empresa.id, fuso: empresa.fuso };
}

export const rotasBonificacaoEntrega: FastifyPluginCallbackZod<{
  ahgora: DependenciasAhgora;
}> = (app, { ahgora }, pronto) => {
  app.get(
    c.unidades.caminho,
    { schema: { response: { 200: c.unidades.saida } }, preHandler: soAdmin },
    async (request) => listarUnidades(request.db, await contextoDe(request)),
  );

  app.get(
    c.parametros.caminho,
    { schema: { response: { 200: c.parametros.saida } }, preHandler: soAdmin },
    async (request) => listarParametros(request.db, await contextoDe(request)),
  );

  app.post(
    c.apurar.caminho,
    {
      schema: { body: c.apurar.entrada, response: { 200: c.apurar.saida } },
      preHandler: soAdmin,
    },
    async (request) => {
      const ctx = await contextoDe(request);
      return apurar(request.db, ctx, request.body, () =>
        clienteDaEmpresa(request.db, ctx.empresaId, ahgora),
      );
    },
  );

  app.get(
    c.faltas.caminho,
    {
      schema: { querystring: c.faltas.entrada, response: { 200: c.faltas.saida } },
      preHandler: soAdmin,
    },
    async (request) => listarFaltas(request.db, await contextoDe(request), request.query),
  );

  app.post(
    c.registrarFalta.caminho,
    {
      schema: { body: c.registrarFalta.entrada, response: { 200: c.registrarFalta.saida } },
      preHandler: soAdmin,
    },
    async (request) =>
      registrarFalta(request.db, await contextoDe(request), await atorDa(request), request.body),
  );

  app.delete(
    c.excluirFalta.caminho,
    {
      schema: { params: c.excluirFalta.parametros, response: { 200: c.excluirFalta.saida } },
      preHandler: soAdmin,
    },
    async (request) => {
      await excluirFalta(
        request.db,
        await contextoDe(request),
        await atorDa(request),
        request.params.id,
      );
      return { ok: true as const };
    },
  );

  pronto();
};
