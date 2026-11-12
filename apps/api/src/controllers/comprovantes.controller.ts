import { contratosComprovantes as c } from "@erp/shared/contratos/comprovantes";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { empresaDaRequisicao } from "../http/middleware/contexto";
import { exigirModulo, exigirPermissao } from "../http/middleware/guardas";
import {
  exportarListaDeComprovantes,
  obterListaDeComprovantes,
  obterPainelDeComprovantes,
} from "../models/comprovantes/comprovantes.service";

/** Comprovantes: só leitura; sem restrição por unidade do usuário (Q26 do dono). */
const ler = [exigirModulo("comprovantes"), exigirPermissao("comprovantes", "ver")];

export const controladorComprovantes: FastifyPluginCallbackZod = (app, _opcoes, pronto) => {
  app.post(
    c.painel.caminho,
    { schema: { body: c.painel.entrada, response: { 200: c.painel.saida } }, preHandler: ler },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      return obterPainelDeComprovantes(request.db, empresa.id, request.body);
    },
  );

  app.post(
    c.lista.caminho,
    { schema: { body: c.lista.entrada, response: { 200: c.lista.saida } }, preHandler: ler },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      return obterListaDeComprovantes(request.db, empresa.id, request.body);
    },
  );

  app.post(
    c.exportar.caminho,
    {
      schema: { body: c.exportar.entrada, response: { 200: c.exportar.saida } },
      preHandler: ler,
    },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      return exportarListaDeComprovantes(request.db, empresa.id, request.body);
    },
  );
  pronto();
};
