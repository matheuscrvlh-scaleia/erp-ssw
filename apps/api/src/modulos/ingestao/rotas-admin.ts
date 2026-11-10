/**
 * Telas de ingestão (Admin › Importação SSW e Admin › XML CT-e): só a equipe da Plataforma, na
 * empresa ativa. Spec 06 §3.13 (retomar/descartar/aplicar manual) e §5.
 */
import {
  descartarCiclo,
  importarRelatorioManual,
  LIMITE_PADRAO_DOS_ORFAOS,
  reprocessarOrfaos,
  retomarCiclo,
} from "@erp/ingestao/casos-de-uso";
import { contratosIngestao as c } from "@erp/shared/contratos/ingestao";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { empresaDaRequisicao } from "../../http/contexto";
import { exigirAdminPlataforma, exigirEmpresa } from "../../http/guardas";
import { atorDa } from "../../plugins/sessao";
import {
  aplicarManualmente,
  importarXmlDaTela,
  type IngestaoDaEmpresa,
  lerAplicacoes,
  lerArquivosXml,
  lerFtp,
  lerPipeline,
  liberarTravaDoFtp,
  pausarOuRetomarFtp,
  rodarFtpAgora,
} from "./casos-de-uso";
import { dependenciasDaEmpresa, type ServicosDaIngestao } from "./servicos";

const LIMITE_COM_ARQUIVO = 64 * 1024 * 1024;
const soPlataforma = [exigirEmpresa, exigirAdminPlataforma];

export const rotasAdminDaIngestao: FastifyPluginCallbackZod<{
  servicos: ServicosDaIngestao;
  agora: () => Date;
}> = (app, { servicos, agora }, pronto) => {
  async function daEmpresa(request: FastifyRequest): Promise<IngestaoDaEmpresa> {
    const { empresa } = await empresaDaRequisicao(request);
    const ator = await atorDa(request);
    return {
      empresaId: empresa.id,
      deps: dependenciasDaEmpresa(servicos, empresa.id, ator, agora),
      servicos,
    };
  }

  app.get(
    c.pipeline.caminho,
    { schema: { response: { 200: c.pipeline.saida } }, preHandler: soPlataforma },
    async (request) => lerPipeline(await daEmpresa(request)),
  );

  app.post(
    c.retomarCiclo.caminho,
    {
      schema: { params: c.retomarCiclo.parametros, response: { 200: c.retomarCiclo.saida } },
      preHandler: soPlataforma,
    },
    async (request) => {
      const { deps } = await daEmpresa(request);
      return retomarCiclo(deps, request.params.chave);
    },
  );

  app.post(
    c.descartarCiclo.caminho,
    {
      schema: {
        params: c.descartarCiclo.parametros,
        body: c.descartarCiclo.entrada,
        response: { 200: c.descartarCiclo.saida },
      },
      preHandler: soPlataforma,
    },
    async (request) => {
      const { deps } = await daEmpresa(request);
      const r = await descartarCiclo(deps, request.params.chave, request.body.motivo);
      return { cicloChave: r.cicloChave, totalRemovido: r.totalRemovido };
    },
  );

  app.post(
    c.importarRelatorio.caminho,
    {
      bodyLimit: LIMITE_COM_ARQUIVO,
      schema: { body: c.importarRelatorio.entrada, response: { 200: c.importarRelatorio.saida } },
      preHandler: soPlataforma,
    },
    async (request) => {
      const { deps } = await daEmpresa(request);
      return importarRelatorioManual(deps.executar, request.body);
    },
  );

  app.post(
    c.aplicar.caminho,
    {
      schema: { body: c.aplicar.entrada, response: { 200: c.aplicar.saida } },
      preHandler: soPlataforma,
    },
    async (request) => {
      const ingestao = await daEmpresa(request);
      const ator = await atorDa(request);
      return aplicarManualmente(ingestao, request.body, ator.usuarioId);
    },
  );

  app.get(
    c.aplicacoes.caminho,
    { schema: { response: { 200: c.aplicacoes.saida } }, preHandler: soPlataforma },
    async (request) => lerAplicacoes(await daEmpresa(request)),
  );

  app.get(
    c.ftp.caminho,
    { schema: { response: { 200: c.ftp.saida } }, preHandler: soPlataforma },
    async (request) => lerFtp(await daEmpresa(request)),
  );

  app.post(
    c.rodarFtp.caminho,
    { schema: { response: { 200: c.rodarFtp.saida } }, preHandler: soPlataforma },
    async (request) => {
      await rodarFtpAgora(await daEmpresa(request));
      return { ok: true as const };
    },
  );

  app.post(
    c.pausarFtp.caminho,
    {
      schema: { body: c.pausarFtp.entrada, response: { 200: c.pausarFtp.saida } },
      preHandler: soPlataforma,
    },
    async (request) => {
      await pausarOuRetomarFtp(await daEmpresa(request), request.body.ativo);
      return { ok: true as const };
    },
  );

  app.post(
    c.liberarTravaFtp.caminho,
    { schema: { response: { 200: c.liberarTravaFtp.saida } }, preHandler: soPlataforma },
    async (request) => {
      await liberarTravaDoFtp(await daEmpresa(request));
      return { ok: true as const };
    },
  );

  app.post(
    c.importarXml.caminho,
    {
      bodyLimit: LIMITE_COM_ARQUIVO,
      schema: { body: c.importarXml.entrada, response: { 200: c.importarXml.saida } },
      preHandler: soPlataforma,
    },
    async (request) => importarXmlDaTela(await daEmpresa(request), request.body, agora()),
  );

  app.get(
    c.arquivosXml.caminho,
    { schema: { response: { 200: c.arquivosXml.saida } }, preHandler: soPlataforma },
    async (request) => lerArquivosXml(await daEmpresa(request)),
  );

  app.post(
    c.reprocessarOrfaos.caminho,
    { schema: { response: { 200: c.reprocessarOrfaos.saida } }, preHandler: soPlataforma },
    async (request) => {
      const { deps } = await daEmpresa(request);
      return reprocessarOrfaos(deps.executar, LIMITE_PADRAO_DOS_ORFAOS, agora());
    },
  );

  pronto();
};
