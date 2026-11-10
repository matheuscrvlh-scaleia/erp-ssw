import { contratosCtrc as c } from "@erp/shared/contratos/ctrc";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { empresaDaRequisicao } from "../../http/contexto";
import { exigirEmpresa } from "../../http/guardas";
import { obterDetalheCtrc } from "./casos-de-uso";

/** O detalhe do CT-e não é tela do menu: basta sessão com empresa (igual a hoje). */
export const rotasCtrc: FastifyPluginCallbackZod<{ agora: () => Date }> = (
  app,
  { agora },
  pronto,
) => {
  app.get(
    c.detalhe.caminho,
    {
      schema: {
        params: c.detalhe.parametros,
        querystring: c.detalhe.entrada,
        response: { 200: c.detalhe.saida },
      },
      preHandler: [exigirEmpresa],
    },
    async (request) => {
      const { empresa } = await empresaDaRequisicao(request);
      return obterDetalheCtrc(
        request.db,
        { empresaId: empresa.id },
        request.params.numero,
        request.query.sigla,
        agora(),
      );
    },
  );
  pronto();
};
