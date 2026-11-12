import { contratosAhgora as c } from "@erp/shared/contratos/ahgora";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { empresaDaRequisicao } from "../http/middleware/contexto";
import { exigirAdminPlataforma, exigirEmpresa } from "../http/middleware/guardas";
import {
  apurarPeriodo,
  clienteDaEmpresa,
  type DependenciasAhgora,
  listarBatidas,
  listarDepartamentos,
  listarFuncionarios,
} from "../models/ahgora/ahgora.service";
import { apresentarApuracao } from "../views/ahgora.view";

/** Ponto (Ahgora): só a equipe da Plataforma, com os dados da empresa ativa (decisão de 09/11). */
const soPlataforma = [exigirEmpresa, exigirAdminPlataforma];

export const controladorAhgora: FastifyPluginCallbackZod<{ ahgora: DependenciasAhgora }> = (
  app,
  { ahgora },
  pronto,
) => {
  const cliente = async (request: FastifyRequest) => {
    const { empresa } = await empresaDaRequisicao(request);
    return clienteDaEmpresa(request.db, empresa.id, ahgora);
  };

  app.get(
    c.funcionarios.caminho,
    { schema: { response: { 200: c.funcionarios.saida } }, preHandler: soPlataforma },
    async (request) => listarFuncionarios(await cliente(request)),
  );

  app.get(
    c.departamentos.caminho,
    { schema: { response: { 200: c.departamentos.saida } }, preHandler: soPlataforma },
    async (request) => listarDepartamentos(await cliente(request)),
  );

  app.get(
    c.batidas.caminho,
    {
      schema: { querystring: c.batidas.entrada, response: { 200: c.batidas.saida } },
      preHandler: soPlataforma,
    },
    async (request) => listarBatidas(await cliente(request), request.query),
  );

  app.get(
    c.apuracao.caminho,
    {
      schema: { querystring: c.apuracao.entrada, response: { 200: c.apuracao.saida } },
      preHandler: soPlataforma,
    },
    async (request) =>
      apresentarApuracao(await apurarPeriodo(await cliente(request), request.query)),
  );

  pronto();
};
