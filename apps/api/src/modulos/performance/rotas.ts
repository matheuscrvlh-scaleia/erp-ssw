import { type Tela } from "@erp/shared/acesso/telas";
import { contratosPerformance as c } from "@erp/shared/contratos/performance";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { empresaDaRequisicao } from "../../http/contexto";
import { semPermissao } from "../../http/erros";
import { exigirEmpresa, exigirModulo, exigirTela, type Guarda } from "../../http/guardas";
import {
  type ContextoPerformance,
  exportarTela,
  obterAlertas,
  obterCodigosDisponiveis,
  obterConfiguracao,
  obterOtif,
  obterPontualidade,
  obterPrevistos,
  obterRelatorio,
  obterResumo,
  obterSerie,
  obterTdeAguardando,
  obterTiposDocumento,
} from "./casos-de-uso";

/** Alguma das telas (a série do gráfico serve à Performance e ao Ranking). */
function exigirAlgumaTela(...telas: Tela[]): Guarda {
  return async (request) => {
    await exigirEmpresa(request);
    const acesso = await request.acesso();
    if (!telas.some((t) => acesso.telas.includes(t))) {
      throw semPermissao("Seu nível de acesso não libera esta tela.");
    }
  };
}

const ler = [exigirModulo("performance"), exigirTela("performance")];
const lerSerie = [
  exigirModulo("performance", "ranking"),
  exigirAlgumaTela("performance", "ranking", "ranking_novo"),
];

async function contextoDe(request: FastifyRequest): Promise<ContextoPerformance> {
  const { empresa } = await empresaDaRequisicao(request);
  return { empresaId: empresa.id, fuso: empresa.fuso };
}

/** Todas as leituras da Performance são POST (o filtro tem listas) e só leem. */
export const rotasPerformance: FastifyPluginCallbackZod<{ agora: () => Date }> = (
  app,
  { agora },
  pronto,
) => {
  app.get(
    c.configuracao.caminho,
    { schema: { response: { 200: c.configuracao.saida } }, preHandler: lerSerie },
    async (request) => obterConfiguracao(request.db, await contextoDe(request)),
  );

  app.post(
    c.resumo.caminho,
    { schema: { body: c.resumo.entrada, response: { 200: c.resumo.saida } }, preHandler: ler },
    async (request) => obterResumo(request.db, await contextoDe(request), request.body, agora()),
  );

  app.post(
    c.pontualidade.caminho,
    {
      schema: { body: c.pontualidade.entrada, response: { 200: c.pontualidade.saida } },
      preHandler: ler,
    },
    async (request) =>
      obterPontualidade(request.db, await contextoDe(request), request.body, agora()),
  );

  app.post(
    c.tdeAguardando.caminho,
    {
      schema: { body: c.tdeAguardando.entrada, response: { 200: c.tdeAguardando.saida } },
      preHandler: ler,
    },
    async (request) =>
      obterTdeAguardando(request.db, await contextoDe(request), request.body, agora()),
  );

  app.post(
    c.otif.caminho,
    { schema: { body: c.otif.entrada, response: { 200: c.otif.saida } }, preHandler: ler },
    async (request) => obterOtif(request.db, await contextoDe(request), request.body, agora()),
  );

  app.post(
    c.alertas.caminho,
    { schema: { body: c.alertas.entrada, response: { 200: c.alertas.saida } }, preHandler: ler },
    async (request) => obterAlertas(request.db, await contextoDe(request), request.body, agora()),
  );

  app.post(
    c.codigosDisponiveis.caminho,
    {
      schema: { body: c.codigosDisponiveis.entrada, response: { 200: c.codigosDisponiveis.saida } },
      preHandler: ler,
    },
    async (request) =>
      obterCodigosDisponiveis(request.db, await contextoDe(request), request.body, agora()),
  );

  app.post(
    c.tiposDocumento.caminho,
    {
      schema: { body: c.tiposDocumento.entrada, response: { 200: c.tiposDocumento.saida } },
      preHandler: ler,
    },
    async (request) =>
      obterTiposDocumento(request.db, await contextoDe(request), request.body, agora()),
  );

  app.post(
    c.exportacao.caminho,
    {
      schema: { body: c.exportacao.entrada, response: { 200: c.exportacao.saida } },
      preHandler: ler,
    },
    async (request) => exportarTela(request.db, await contextoDe(request), request.body, agora()),
  );

  app.post(
    c.previstos.caminho,
    {
      schema: { body: c.previstos.entrada, response: { 200: c.previstos.saida } },
      preHandler: ler,
    },
    async (request) => obterPrevistos(request.db, await contextoDe(request), request.body, agora()),
  );

  app.post(
    c.serie.caminho,
    { schema: { body: c.serie.entrada, response: { 200: c.serie.saida } }, preHandler: lerSerie },
    async (request) => obterSerie(request.db, await contextoDe(request), request.body, agora()),
  );

  app.post(
    c.relatorio.caminho,
    {
      schema: { body: c.relatorio.entrada, response: { 200: c.relatorio.saida } },
      preHandler: ler,
    },
    async (request) => obterRelatorio(request.db, await contextoDe(request), request.body, agora()),
  );
  pronto();
};
