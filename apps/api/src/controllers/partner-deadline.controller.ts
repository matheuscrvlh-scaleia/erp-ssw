import { contratosPrazoParceiro as c } from "@erp/shared/contracts/partner-deadline";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import {
  exportarLista,
  obterDetalhe,
  obterLista,
  obterOpcoes,
  obterVisaoGeral,
} from "../models/partner-deadline/partner-deadline.service";
import {
  apresentarDetalhe,
  apresentarExportacao,
  apresentarLista,
  apresentarOpcoes,
} from "../views/partner-deadline.view";
import { exigirModulo, exigirPermissao } from "./middleware/guards";

/** Só leitura: quem tem a tela, com o módulo liberado. */
const ler = [exigirModulo("prazo_parceiro"), exigirPermissao("prazo_parceiro", "ver")];

export const controladorPrazoParceiro: FastifyPluginCallbackZod = (app, _opcoes, pronto) => {
  app.post(
    c.visaoGeral.caminho,
    {
      schema: { body: c.visaoGeral.entrada, response: { 200: c.visaoGeral.saida } },
      preHandler: ler,
    },
    (request) => obterVisaoGeral(request.db, request.body),
  );
  app.get(
    c.opcoes.caminho,
    {
      schema: { querystring: c.opcoes.entrada, response: { 200: c.opcoes.saida } },
      preHandler: ler,
    },
    async (request) => apresentarOpcoes(await obterOpcoes(request.db, request.query)),
  );
  app.post(
    c.lista.caminho,
    { schema: { body: c.lista.entrada, response: { 200: c.lista.saida } }, preHandler: ler },
    async (request) => apresentarLista(await obterLista(request.db, request.body)),
  );
  app.post(
    c.exportar.caminho,
    { schema: { body: c.exportar.entrada, response: { 200: c.exportar.saida } }, preHandler: ler },
    async (request) => apresentarExportacao(await exportarLista(request.db, request.body)),
  );
  app.post(
    c.detalhe.caminho,
    {
      schema: {
        params: c.detalhe.parametros,
        body: c.detalhe.entrada,
        response: { 200: c.detalhe.saida },
      },
      preHandler: ler,
    },
    async (request) =>
      apresentarDetalhe(await obterDetalhe(request.db, request.params.id, request.body)),
  );
  pronto();
};
