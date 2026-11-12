/**
 * Telas de ingestão (Admin › Importação SSW e Admin › XML CT-e): só a equipe da Plataforma, na
 * empresa ativa. Spec 06 §3.13 (retomar/descartar/aplicar manual) e §5; ADR 0012.
 */
import { type Acao } from "@erp/shared/acesso/permissoes";
import { type Tela } from "@erp/shared/acesso/telas";
import { contratosIngestao as c } from "@erp/shared/contratos/ingestao";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { empresaDaRequisicao } from "../http/middleware/contexto";
import { exigirAdminPlataforma, exigirPermissao } from "../http/middleware/guardas";
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
import { confirmacao } from "../views/comum.view";
import {
  apresentarAplicacoes,
  apresentarArquivosXml,
  apresentarFtp,
  apresentarPipeline,
} from "../views/ingestao.view";

/** Arquivo em base64 da tela: o mesmo teto de antes (o worker-ssw tem o mesmo). */
const LIMITE_COM_ARQUIVO = 64 * 1024 * 1024;
/** Ferramenta da Plataforma dentro da empresa aberta: a ação vem do cargo na Plataforma. */
const naPlataforma = (tela: Tela, acao: Acao) => [
  exigirPermissao(tela, acao),
  exigirAdminPlataforma,
];

export const controladorIngestao: FastifyPluginCallbackZod<{ deps: DependenciasIngestao }> = (
  app,
  { deps },
  pronto,
) => {
  const empresa = async (request: FastifyRequest) =>
    (await empresaDaRequisicao(request)).empresa.id;

  app.get(
    c.pipeline.caminho,
    {
      schema: { response: { 200: c.pipeline.saida } },
      preHandler: naPlataforma("admin_importacao_ssw", "ver"),
    },
    async (request) =>
      apresentarPipeline(await lerPipeline(request.db, deps, await empresa(request))),
  );

  app.post(
    c.retomarCiclo.caminho,
    {
      schema: { params: c.retomarCiclo.parametros, response: { 200: c.retomarCiclo.saida } },
      preHandler: naPlataforma("admin_importacao_ssw", "editar"),
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
      preHandler: naPlataforma("admin_importacao_ssw", "excluir"),
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
      preHandler: naPlataforma("admin_importacao_ssw", "editar"),
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
      preHandler: naPlataforma("admin_importacao_ssw", "editar"),
    },
    async (request) =>
      aplicar(request.db, deps, await atorDa(request), await empresa(request), request.body),
  );

  app.get(
    c.aplicacoes.caminho,
    {
      schema: { response: { 200: c.aplicacoes.saida } },
      preHandler: naPlataforma("admin_importacao_ssw", "ver"),
    },
    async (request) =>
      apresentarAplicacoes(await lerAplicacoes(request.db, await empresa(request))),
  );

  app.get(
    c.ftp.caminho,
    {
      schema: { response: { 200: c.ftp.saida } },
      preHandler: naPlataforma("admin_xml_cte", "ver"),
    },
    async (request) => apresentarFtp(await lerFtp(request.db, deps, await empresa(request))),
  );

  app.post(
    c.rodarFtp.caminho,
    {
      schema: { response: { 200: c.rodarFtp.saida } },
      preHandler: naPlataforma("admin_xml_cte", "editar"),
    },
    async (request) => {
      await rodarFtpAgora(request.db, deps, await atorDa(request), await empresa(request));
      return confirmacao();
    },
  );

  app.post(
    c.pausarFtp.caminho,
    {
      schema: { body: c.pausarFtp.entrada, response: { 200: c.pausarFtp.saida } },
      preHandler: naPlataforma("admin_xml_cte", "editar"),
    },
    async (request) => {
      await pausarOuRetomarFtp(
        request.db,
        deps,
        await atorDa(request),
        await empresa(request),
        request.body.ativo,
      );
      return confirmacao();
    },
  );

  app.post(
    c.liberarTravaFtp.caminho,
    {
      schema: { response: { 200: c.liberarTravaFtp.saida } },
      preHandler: naPlataforma("admin_xml_cte", "editar"),
    },
    async (request) => {
      await liberarTravaFtp(request.db, deps, await atorDa(request), await empresa(request));
      return confirmacao();
    },
  );

  app.post(
    c.importarXml.caminho,
    {
      bodyLimit: LIMITE_COM_ARQUIVO,
      schema: { body: c.importarXml.entrada, response: { 200: c.importarXml.saida } },
      preHandler: naPlataforma("admin_xml_cte", "editar"),
    },
    async (request) =>
      importarXml(request.db, deps, await atorDa(request), await empresa(request), request.body),
  );

  app.get(
    c.arquivosXml.caminho,
    {
      schema: { response: { 200: c.arquivosXml.saida } },
      preHandler: naPlataforma("admin_xml_cte", "ver"),
    },
    async (request) =>
      apresentarArquivosXml(await lerArquivosXml(request.db, await empresa(request))),
  );

  app.post(
    c.reprocessarOrfaos.caminho,
    {
      schema: { response: { 200: c.reprocessarOrfaos.saida } },
      preHandler: naPlataforma("admin_xml_cte", "editar"),
    },
    async (request) =>
      reprocessarOrfaos(request.db, deps, await atorDa(request), await empresa(request)),
  );

  pronto();
};
