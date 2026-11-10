import { contratosAdmin as c, contratosConfiguracoes } from "@erp/shared/contratos/admin";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { empresaDaRequisicao } from "../../http/contexto";
import { exigirAdminDaEmpresa, exigirAutenticacao, exigirTela } from "../../http/guardas";
import { atorDa } from "../../plugins/sessao";
import { type CacheDeConfiguracoes } from "./cache";
import { configuracoesPublicas, listarConfiguracoes, salvarConfiguracoes } from "./casos-de-uso";

/** Admin › Configurações: admin com a tela, sem módulo (essencial). */
const admin = [exigirAdminDaEmpresa, exigirTela("admin_configuracoes")];

export const rotasConfiguracoes: FastifyPluginCallbackZod<{ cache: CacheDeConfiguracoes }> = (
  app,
  { cache },
  pronto,
) => {
  app.get(
    c.listarConfiguracoes.caminho,
    { schema: { response: { 200: c.listarConfiguracoes.saida } }, onRequest: admin },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      return { configuracoes: await listarConfiguracoes(request.db, empresa.id) };
    },
  );

  app.put(
    c.salvarConfiguracoes.caminho,
    {
      schema: {
        params: c.salvarConfiguracoes.parametros,
        body: c.salvarConfiguracoes.entrada,
        response: { 200: c.salvarConfiguracoes.saida },
      },
      onRequest: admin,
    },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      return salvarConfiguracoes(
        request.db,
        cache,
        empresa.id,
        await atorDa(request),
        request.params.grupo,
        request.body.itens,
      );
    },
  );

  // Qualquer usuário autenticado: sem empresa (ou conta desativada), nada.
  app.get(
    contratosConfiguracoes.publicas.caminho,
    {
      schema: { response: { 200: contratosConfiguracoes.publicas.saida } },
      onRequest: exigirAutenticacao,
    },
    async (request) => {
      const acesso = await request.acesso();
      const empresaId = acesso.ativo ? (acesso.empresa?.id ?? null) : null;
      return { valores: await configuracoesPublicas(request.db, empresaId) };
    },
  );
  pronto();
};
