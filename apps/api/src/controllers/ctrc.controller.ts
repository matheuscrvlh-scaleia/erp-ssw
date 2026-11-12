import { contratosCtrc as c } from "@erp/shared/contratos/ctrc";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { obterDetalheCtrc } from "../models/ctrc/ctrc.service";
import { apresentarBuscaDoCtrc } from "../views/ctrc.view";
import { empresaDaRequisicao } from "./middleware/contexto";
import { exigirEmpresa } from "./middleware/guardas";

/** O detalhe do CT-e não é tela do menu: basta sessão com empresa (igual a hoje). */
export const controladorCtrc: FastifyPluginCallbackZod<{ agora: () => Date }> = (
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
      return apresentarBuscaDoCtrc(
        await obterDetalheCtrc(
          request.db,
          { empresaId: empresa.id },
          request.params.numero,
          request.query.sigla,
          agora(),
        ),
      );
    },
  );
  pronto();
};
