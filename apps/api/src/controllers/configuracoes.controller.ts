import { contratosAdmin as c, contratosConfiguracoes } from "@erp/shared/contratos/admin";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { empresaDaRequisicao } from "../http/middleware/contexto";
import { exigirAutenticacao, exigirPermissao } from "../http/middleware/guardas";
import { atorDa } from "../http/middleware/sessao";
import { type CacheDeConfiguracoes } from "../models/configuracoes/cache";
import {
  configuracoesPublicas,
  listarConfiguracoes,
  salvarConfiguracoes,
} from "../models/configuracoes/configuracoes.service";
import {
  apresentarConfiguracoes,
  apresentarConfiguracoesPublicas,
} from "../views/configuracoes.view";

/** Admin › Configurações: admin com a tela, sem módulo (essencial). */
const ler = exigirPermissao("admin_configuracoes", "ver");
const editar = exigirPermissao("admin_configuracoes", "editar");

export const controladorConfiguracoes: FastifyPluginCallbackZod<{ cache: CacheDeConfiguracoes }> = (
  app,
  { cache },
  pronto,
) => {
  app.get(
    c.listarConfiguracoes.caminho,
    { schema: { response: { 200: c.listarConfiguracoes.saida } }, onRequest: ler },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      return apresentarConfiguracoes(await listarConfiguracoes(request.db, empresa.id));
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
      onRequest: editar,
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
      return apresentarConfiguracoesPublicas(await configuracoesPublicas(request.db, empresaId));
    },
  );
  pronto();
};
