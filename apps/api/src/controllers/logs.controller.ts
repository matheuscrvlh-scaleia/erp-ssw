import { contratosAuditoria as c } from "@erp/shared/contracts/audit";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import {
  type EscopoDosLogs,
  listarAlteracoes,
  listarIntegracoes,
} from "../models/logs/logs.service";
import { type ExecutorComContexto } from "../models/repositories";
import { apresentarAlteracoes, apresentarIntegracoes } from "../views/logs.view";
import { empresaDaRequisicao, executorDePlataforma } from "./middleware/context";
import { exigirPermissao, exigirPermissaoDaPlataforma } from "./middleware/guards";

/** Admin › Logs: admin (ou Plataforma) na empresa ativa; só os registros dela (Q31). */
/** Logs da empresa: dado por regra ao admin da empresa e à Plataforma. */
const adminDaEmpresa = exigirPermissao("admin_logs", "ver");

export const controladorLogs: FastifyPluginCallbackZod<{ executar: ExecutorComContexto }> = (
  app,
  { executar },
  pronto,
) => {
  app.get(
    c.alteracoesDaEmpresa.caminho,
    {
      schema: {
        querystring: c.alteracoesDaEmpresa.entrada,
        response: { 200: c.alteracoesDaEmpresa.saida },
      },
      onRequest: adminDaEmpresa,
    },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      return apresentarAlteracoes(
        await listarAlteracoes(
          request.db,
          { tipo: "empresa", empresaId: empresa.id },
          request.query,
        ),
      );
    },
  );

  app.get(
    c.integracoesDaEmpresa.caminho,
    {
      schema: {
        querystring: c.integracoesDaEmpresa.entrada,
        response: { 200: c.integracoesDaEmpresa.saida },
      },
      onRequest: adminDaEmpresa,
    },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      return apresentarIntegracoes(await listarIntegracoes(request.db, empresa.id, request.query));
    },
  );

  app.get(
    c.alteracoesDaPlataforma.caminho,
    {
      schema: {
        querystring: c.alteracoesDaPlataforma.entrada,
        response: { 200: c.alteracoesDaPlataforma.saida },
      },
      onRequest: exigirPermissaoDaPlataforma("plataforma_logs", "ver"),
    },
    async (request) => {
      const { empresa, ...filtros } = request.query;
      const escopo: EscopoDosLogs =
        empresa === undefined
          ? { tipo: "todas" }
          : empresa === "plataforma"
            ? { tipo: "plataforma" }
            : { tipo: "empresa", empresaId: empresa };
      return apresentarAlteracoes(
        await listarAlteracoes(executorDePlataforma(executar, request, null), escopo, filtros),
      );
    },
  );

  app.get(
    c.integracoesDeEmpresaNaPlataforma.caminho,
    {
      schema: {
        params: c.integracoesDeEmpresaNaPlataforma.parametros,
        querystring: c.integracoesDeEmpresaNaPlataforma.entrada,
        response: { 200: c.integracoesDeEmpresaNaPlataforma.saida },
      },
      onRequest: exigirPermissaoDaPlataforma("plataforma_logs", "ver"),
    },
    async (request) =>
      apresentarIntegracoes(
        await listarIntegracoes(
          executorDePlataforma(executar, request, request.params.id),
          request.params.id,
          request.query,
        ),
      ),
  );
  pronto();
};
