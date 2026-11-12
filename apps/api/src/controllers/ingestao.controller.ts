/**
 * Telas de ingestão (Admin › Importação SSW e Admin › XML CT-e): só a equipe da Plataforma, na
 * empresa ativa. Spec 06 §3.13 (retomar/descartar/aplicar manual) e §5; ADR 0012.
 */
import { contratosIngestao as c } from "@erp/shared/contratos/ingestao";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { empresaDaRequisicao } from "../http/middleware/contexto";
import { exigirAdminPlataforma, exigirEmpresa } from "../http/middleware/guardas";
import { atorDa } from "../http/middleware/sessao";
import {
  aplicar,
  type DependenciasIngestao,
  descartarCiclo,
  importarRelatorio,
  importarXml,
  lerAplicacoes,
  lerArquivosXml,
  lerFtp,
  lerPipeline,
  liberarTravaFtp,
  pausarOuRetomarFtp,
  reprocessarOrfaos,
  retomarCiclo,
  rodarFtpAgora,
} from "../models/ingestao/ingestao.service";

/** Arquivo em base64 da tela: o mesmo teto de antes (o worker-ssw tem o mesmo). */
const LIMITE_COM_ARQUIVO = 64 * 1024 * 1024;
const soPlataforma = [exigirEmpresa, exigirAdminPlataforma];

export const controladorIngestao: FastifyPluginCallbackZod<{ deps: DependenciasIngestao }> = (
  app,
  { deps },
  pronto,
) => {
  const empresa = async (request: FastifyRequest) =>
    (await empresaDaRequisicao(request)).empresa.id;

  app.get(
    c.pipeline.caminho,
    { schema: { response: { 200: c.pipeline.saida } }, preHandler: soPlataforma },
    async (request) => lerPipeline(request.db, deps, await empresa(request)),
  );

  app.post(
    c.retomarCiclo.caminho,
    {
      schema: { params: c.retomarCiclo.parametros, response: { 200: c.retomarCiclo.saida } },
      preHandler: soPlataforma,
    },
    async (request) =>
      retomarCiclo(
        request.db,
        deps,
        await atorDa(request),
        await empresa(request),
        request.params.chave,
      ),
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
    async (request) =>
      descartarCiclo(
        request.db,
        deps,
        await atorDa(request),
        await empresa(request),
        request.params.chave,
        request.body.motivo,
      ),
  );

  app.post(
    c.importarRelatorio.caminho,
    {
      bodyLimit: LIMITE_COM_ARQUIVO,
      schema: { body: c.importarRelatorio.entrada, response: { 200: c.importarRelatorio.saida } },
      preHandler: soPlataforma,
    },
    async (request) =>
      importarRelatorio(
        request.db,
        deps,
        await atorDa(request),
        await empresa(request),
        request.body,
      ),
  );

  app.post(
    c.aplicar.caminho,
    {
      schema: { body: c.aplicar.entrada, response: { 200: c.aplicar.saida } },
      preHandler: soPlataforma,
    },
    async (request) =>
      aplicar(request.db, deps, await atorDa(request), await empresa(request), request.body),
  );

  app.get(
    c.aplicacoes.caminho,
    { schema: { response: { 200: c.aplicacoes.saida } }, preHandler: soPlataforma },
    async (request) => lerAplicacoes(request.db, await empresa(request)),
  );

  app.get(
    c.ftp.caminho,
    { schema: { response: { 200: c.ftp.saida } }, preHandler: soPlataforma },
    async (request) => lerFtp(request.db, deps, await empresa(request)),
  );

  app.post(
    c.rodarFtp.caminho,
    { schema: { response: { 200: c.rodarFtp.saida } }, preHandler: soPlataforma },
    async (request) => {
      await rodarFtpAgora(request.db, deps, await atorDa(request), await empresa(request));
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
      await pausarOuRetomarFtp(
        request.db,
        deps,
        await atorDa(request),
        await empresa(request),
        request.body.ativo,
      );
      return { ok: true as const };
    },
  );

  app.post(
    c.liberarTravaFtp.caminho,
    { schema: { response: { 200: c.liberarTravaFtp.saida } }, preHandler: soPlataforma },
    async (request) => {
      await liberarTravaFtp(request.db, deps, await atorDa(request), await empresa(request));
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
    async (request) =>
      importarXml(request.db, deps, await atorDa(request), await empresa(request), request.body),
  );

  app.get(
    c.arquivosXml.caminho,
    { schema: { response: { 200: c.arquivosXml.saida } }, preHandler: soPlataforma },
    async (request) => lerArquivosXml(request.db, await empresa(request)),
  );

  app.post(
    c.reprocessarOrfaos.caminho,
    { schema: { response: { 200: c.reprocessarOrfaos.saida } }, preHandler: soPlataforma },
    async (request) =>
      reprocessarOrfaos(request.db, deps, await atorDa(request), await empresa(request)),
  );

  pronto();
};
