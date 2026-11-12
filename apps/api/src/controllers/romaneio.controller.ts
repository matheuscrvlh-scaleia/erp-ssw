import { contratosRomaneio as c } from "@erp/shared/contratos/romaneio";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { empresaDaRequisicao } from "../http/middleware/contexto";
import { exigirModulo, exigirPermissao } from "../http/middleware/guardas";
import {
  type ContextoRomaneio,
  exportarLista,
  obterCtesDoDia,
  obterCtesPorCarro,
  obterDistribuicao,
  obterHoje,
  obterKpis,
  obterLinhaDoTempo,
  obterLista,
  obterMotivos,
  obterOpcoes,
  obterPerformanceAjudantes,
  obterPerformanceCarros,
  obterPerformanceMotoristas,
  obterPorViagem,
  obterPrejuizo,
  obterTotais,
} from "../models/romaneio/romaneio.service";
import {
  apresentarExportacao,
  apresentarLinhaDoTempo,
  apresentarLista,
  apresentarOpcoes,
} from "../views/romaneio.view";

/** Só leitura: quem tem a tela, com o módulo liberado. Placa em Performance: `romaneio_placa`. */
const ler = [exigirModulo("romaneio"), exigirPermissao("romaneio", "ver")];

async function contextoDe(request: FastifyRequest): Promise<ContextoRomaneio> {
  const { acesso, empresa } = await empresaDaRequisicao(request);
  return { fuso: empresa.fuso, verPlaca: acesso.telas.includes("romaneio_placa") };
}

export const controladorRomaneio: FastifyPluginCallbackZod<{ agora: () => Date }> = (
  app,
  { agora },
  pronto,
) => {
  app.post(
    c.hoje.caminho,
    { schema: { body: c.hoje.entrada, response: { 200: c.hoje.saida } }, preHandler: ler },
    async (request) => obterHoje(request.db, await contextoDe(request), request.body, agora()),
  );
  app.post(
    c.hojeCtes.caminho,
    { schema: { body: c.hojeCtes.entrada, response: { 200: c.hojeCtes.saida } }, preHandler: ler },
    async (request) => obterCtesDoDia(request.db, await contextoDe(request), request.body, agora()),
  );
  app.post(
    c.totais.caminho,
    { schema: { body: c.totais.entrada, response: { 200: c.totais.saida } }, preHandler: ler },
    async (request) => obterTotais(request.db, await contextoDe(request), request.body, agora()),
  );
  app.post(
    c.lista.caminho,
    { schema: { body: c.lista.entrada, response: { 200: c.lista.saida } }, preHandler: ler },
    async (request) =>
      apresentarLista(
        await obterLista(request.db, await contextoDe(request), request.body, agora()),
      ),
  );
  app.post(
    c.exportar.caminho,
    { schema: { body: c.exportar.entrada, response: { 200: c.exportar.saida } }, preHandler: ler },
    async (request) =>
      apresentarExportacao(
        await exportarLista(request.db, await contextoDe(request), request.body, agora()),
      ),
  );
  app.post(
    c.distribuicao.caminho,
    {
      schema: { body: c.distribuicao.entrada, response: { 200: c.distribuicao.saida } },
      preHandler: ler,
    },
    (request) => obterDistribuicao(request.db, request.body),
  );
  app.post(
    c.kpis.caminho,
    { schema: { body: c.kpis.entrada, response: { 200: c.kpis.saida } }, preHandler: ler },
    (request) => obterKpis(request.db, request.body),
  );
  app.post(
    c.ctesPorCarro.caminho,
    {
      schema: { body: c.ctesPorCarro.entrada, response: { 200: c.ctesPorCarro.saida } },
      preHandler: ler,
    },
    (request) => obterCtesPorCarro(request.db, request.body),
  );
  app.post(
    c.porViagem.caminho,
    {
      schema: { body: c.porViagem.entrada, response: { 200: c.porViagem.saida } },
      preHandler: ler,
    },
    (request) => obterPorViagem(request.db, request.body),
  );
  app.post(
    c.performanceMotoristas.caminho,
    {
      schema: {
        body: c.performanceMotoristas.entrada,
        response: { 200: c.performanceMotoristas.saida },
      },
      preHandler: ler,
    },
    async (request) =>
      obterPerformanceMotoristas(request.db, await contextoDe(request), request.body),
  );
  app.post(
    c.performanceAjudantes.caminho,
    {
      schema: {
        body: c.performanceAjudantes.entrada,
        response: { 200: c.performanceAjudantes.saida },
      },
      preHandler: ler,
    },
    async (request) =>
      obterPerformanceAjudantes(request.db, await contextoDe(request), request.body),
  );
  app.post(
    c.performanceCarros.caminho,
    {
      schema: {
        body: c.performanceCarros.entrada,
        response: { 200: c.performanceCarros.saida },
      },
      preHandler: ler,
    },
    (request) => obterPerformanceCarros(request.db, request.body),
  );
  app.post(
    c.prejuizo.caminho,
    { schema: { body: c.prejuizo.entrada, response: { 200: c.prejuizo.saida } }, preHandler: ler },
    (request) => obterPrejuizo(request.db, request.body),
  );
  app.post(
    c.motivos.caminho,
    { schema: { body: c.motivos.entrada, response: { 200: c.motivos.saida } }, preHandler: ler },
    (request) => obterMotivos(request.db, request.body),
  );
  app.post(
    c.opcoes.caminho,
    { schema: { body: c.opcoes.entrada, response: { 200: c.opcoes.saida } }, preHandler: ler },
    async (request) => apresentarOpcoes(await obterOpcoes(request.db, request.body)),
  );
  app.get(
    c.linhaDoTempo.caminho,
    {
      schema: { params: c.linhaDoTempo.parametros, response: { 200: c.linhaDoTempo.saida } },
      preHandler: ler,
    },
    async (request) =>
      apresentarLinhaDoTempo(
        await obterLinhaDoTempo(request.db, request.params.sigla, request.params.numero),
      ),
  );
  pronto();
};
