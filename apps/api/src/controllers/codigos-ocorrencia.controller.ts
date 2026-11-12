import { contratosCodigosOcorrencia as c } from "@erp/shared/contratos/codigos-ocorrencia";
import { type FastifyRequest } from "fastify";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import {
  alterarEmLote,
  type ContextoCodigos,
  type DependenciasCodigos,
  historicoDoCodigoNaEmpresa,
  listarCodigos,
  salvarCodigo,
} from "../models/codigos-ocorrencia/codigos-ocorrencia.service";
import {
  apresentarCatalogoDeCodigos,
  apresentarHistoricoDoCodigo,
} from "../views/codigos-ocorrencia.view";
import { empresaDaRequisicao } from "./middleware/contexto";
import { exigirModulo, exigirPermissao } from "./middleware/guardas";
import { atorDa } from "./middleware/sessao";

/**
 * Ler: quem tem a tela; escrever e ver o histórico: admin da empresa (hoje um não-admin recebe
 * "ok" sem nada mudar; aqui recebe 403). Sempre com o módulo Ocorrências.
 */
const ler = [exigirModulo("ocorrencias"), exigirPermissao("admin_codigos", "ver")];
const escrever = [exigirModulo("ocorrencias"), exigirPermissao("admin_codigos", "editar")];

async function contextoDe(request: FastifyRequest): Promise<ContextoCodigos> {
  const { acesso, empresa } = await empresaDaRequisicao(request);
  return { empresaId: empresa.id, usuarioId: acesso.usuario.id };
}

export const controladorCodigosOcorrencia: FastifyPluginCallbackZod<
  DependenciasCodigos & { agora: () => Date }
> = (app, { agora, fila }, pronto) => {
  const deps: DependenciasCodigos = { fila };

  app.get(
    c.listar.caminho,
    { schema: { response: { 200: c.listar.saida } }, preHandler: ler },
    async (request) =>
      apresentarCatalogoDeCodigos(
        await listarCodigos(request.db, await contextoDe(request), agora()),
      ),
  );

  app.get(
    c.historico.caminho,
    {
      schema: { params: c.historico.parametros, response: { 200: c.historico.saida } },
      preHandler: escrever,
    },
    async (request) =>
      apresentarHistoricoDoCodigo(
        await historicoDoCodigoNaEmpresa(
          request.db,
          await contextoDe(request),
          request.params.codigo,
        ),
      ),
  );

  app.put(
    c.salvar.caminho,
    {
      schema: {
        params: c.salvar.parametros,
        body: c.salvar.entrada,
        response: { 200: c.salvar.saida },
      },
      preHandler: escrever,
    },
    async (request) =>
      salvarCodigo(
        request.db,
        deps,
        await contextoDe(request),
        await atorDa(request),
        request.params.codigo,
        request.body,
        agora(),
      ),
  );

  app.post(
    c.lote.caminho,
    { schema: { body: c.lote.entrada, response: { 200: c.lote.saida } }, preHandler: escrever },
    async (request) =>
      alterarEmLote(
        request.db,
        deps,
        await contextoDe(request),
        await atorDa(request),
        request.body,
        agora(),
      ),
  );
  pronto();
};
