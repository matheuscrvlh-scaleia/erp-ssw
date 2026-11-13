import { contratosOcorrencias as c } from "@erp/shared/contracts/occurrences";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import {
  type ContextoOcorrencias,
  exportarLista,
  listarConferentes,
  obterCodigosDoCard,
  obterLista,
  obterOpcoes,
  obterPainel,
} from "../models/occurrences/occurrences.service";
import {
  apresentarCodigosDoCard,
  apresentarConferentes,
  apresentarExportacaoDeOcorrencias,
  apresentarOpcoesDeOcorrencias,
} from "../views/occurrences.view";
import { empresaDaRequisicao } from "./middleware/context";
import { exigirModulo, exigirPermissao } from "./middleware/guards";

const ler = [exigirModulo("ocorrencias"), exigirPermissao("ocorrencias", "ver")];

async function contextoDaEmpresa(request: FastifyRequest): Promise<ContextoOcorrencias> {
  const { empresa } = await empresaDaRequisicao(request);
  return { empresaId: empresa.id, fuso: empresa.fuso };
}

/** Tela Ocorrências: só leitura, para quem tem a tela e o módulo. */
export const controladorOcorrencias: FastifyPluginCallbackZod<{ agora: () => Date }> = (
  app,
  { agora },
  pronto,
) => {
  app.post(
    c.painel.caminho,
    { schema: { body: c.painel.entrada, response: { 200: c.painel.saida } }, preHandler: ler },
    async (request) =>
      obterPainel(request.db, await contextoDaEmpresa(request), request.body, agora()),
  );

  app.post(
    c.lista.caminho,
    { schema: { body: c.lista.entrada, response: { 200: c.lista.saida } }, preHandler: ler },
    async (request) =>
      obterLista(request.db, await contextoDaEmpresa(request), request.body, agora()),
  );

  app.post(
    c.exportar.caminho,
    {
      schema: { body: c.exportar.entrada, response: { 200: c.exportar.saida } },
      preHandler: ler,
    },
    async (request) =>
      apresentarExportacaoDeOcorrencias(
        await exportarLista(request.db, await contextoDaEmpresa(request), request.body, agora()),
      ),
  );

  app.post(
    c.codigosDoCard.caminho,
    {
      schema: { body: c.codigosDoCard.entrada, response: { 200: c.codigosDoCard.saida } },
      preHandler: ler,
    },
    async (request) =>
      apresentarCodigosDoCard(
        await obterCodigosDoCard(
          request.db,
          await contextoDaEmpresa(request),
          request.body,
          agora(),
        ),
      ),
  );

  app.post(
    c.opcoes.caminho,
    { schema: { body: c.opcoes.entrada, response: { 200: c.opcoes.saida } }, preHandler: ler },
    async (request) =>
      apresentarOpcoesDeOcorrencias(
        await obterOpcoes(request.db, await contextoDaEmpresa(request), request.body),
      ),
  );

  app.get(
    c.conferentes.caminho,
    { schema: { response: { 200: c.conferentes.saida } }, preHandler: ler },
    async (request) =>
      apresentarConferentes(await listarConferentes(request.db, await contextoDaEmpresa(request))),
  );
  pronto();
};
