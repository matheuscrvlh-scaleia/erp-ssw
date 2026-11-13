import { contratosBonificacaoEntrega as c } from "@erp/shared/contracts/delivery-bonus";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { clienteDaEmpresa, type DependenciasAhgora } from "../models/ahgora/ahgora.service";
import {
  apurar,
  type ContextoBonificacao,
  excluirFalta,
  listarFaltas,
  listarParametros,
  listarUnidades,
  registrarFalta,
} from "../models/delivery-bonus/delivery-bonus.service";
import { confirmacao } from "../views/common.view";
import { empresaDaRequisicao } from "./middleware/context";
import { exigirModulo, exigirPermissao } from "./middleware/guards";
import { atorDa } from "./middleware/session";

const modulo = exigirModulo("ponto_bonificacao");
const ler = [modulo, exigirPermissao("admin_bonificacao_entrega", "ver")];
const editar = [modulo, exigirPermissao("admin_bonificacao_entrega", "editar")];
const excluir = [modulo, exigirPermissao("admin_bonificacao_entrega", "excluir")];

async function contextoDe(request: FastifyRequest): Promise<ContextoBonificacao> {
  const { empresa } = await empresaDaRequisicao(request);
  return { empresaId: empresa.id, fuso: empresa.fuso };
}

export const controladorBonificacaoEntrega: FastifyPluginCallbackZod<{
  ahgora: DependenciasAhgora;
}> = (app, { ahgora }, pronto) => {
  app.get(
    c.unidades.caminho,
    { schema: { response: { 200: c.unidades.saida } }, preHandler: ler },
    async (request) => listarUnidades(request.db, await contextoDe(request)),
  );

  app.get(
    c.parametros.caminho,
    { schema: { response: { 200: c.parametros.saida } }, preHandler: ler },
    async (request) => listarParametros(request.db, await contextoDe(request)),
  );

  // POST só pelo corpo do filtro: apurar calcula e não grava nada, então basta Ver.
  app.post(
    c.apurar.caminho,
    {
      schema: { body: c.apurar.entrada, response: { 200: c.apurar.saida } },
      preHandler: ler,
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
      preHandler: ler,
    },
    async (request) => listarFaltas(request.db, await contextoDe(request), request.query),
  );

  app.post(
    c.registrarFalta.caminho,
    {
      schema: { body: c.registrarFalta.entrada, response: { 200: c.registrarFalta.saida } },
      preHandler: editar,
    },
    async (request) =>
      registrarFalta(request.db, await contextoDe(request), await atorDa(request), request.body),
  );

  app.delete(
    c.excluirFalta.caminho,
    {
      schema: { params: c.excluirFalta.parametros, response: { 200: c.excluirFalta.saida } },
      preHandler: excluir,
    },
    async (request) => {
      await excluirFalta(
        request.db,
        await contextoDe(request),
        await atorDa(request),
        request.params.id,
      );
      return confirmacao();
    },
  );

  pronto();
};
