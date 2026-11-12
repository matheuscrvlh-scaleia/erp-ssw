import { contratosPainelPlataforma as c } from "@erp/shared/contratos/painel-plataforma";
import { type FastifyPluginCallbackZod } from "fastify-type-provider-zod";

import { executorDePlataforma } from "../http/middleware/contexto";
import { exigirPermissaoDaPlataforma } from "../http/middleware/guardas";
import { type ClienteWorkerSsw } from "../infra/worker-ssw";
import {
  criarCacheDoPainel,
  obterPainel,
} from "../models/painel-plataforma/painel-plataforma.service";
import { type ExecutorComContexto } from "../models/repositorios";
import { apresentarPainel } from "../views/painel-plataforma.view";

export interface OpcoesRotasPainelPlataforma {
  executar: ExecutorComContexto;
  workerSsw: ClienteWorkerSsw | null;
  agora: () => Date;
}

/** Plataforma › Dashboard: só a equipe da Plataforma (o guard roda antes de qualquer leitura). */
export const controladorPainelPlataforma: FastifyPluginCallbackZod<OpcoesRotasPainelPlataforma> = (
  app,
  opcoes,
  pronto,
) => {
  const doCache = criarCacheDoPainel(opcoes.agora);

  app.get(
    c.obter.caminho,
    {
      schema: { response: { 200: c.obter.saida } },
      onRequest: exigirPermissaoDaPlataforma("plataforma_painel", "ver"),
    },
    async (request) =>
      apresentarPainel(
        await doCache(() =>
          obterPainel((empresaId) => executorDePlataforma(opcoes.executar, request, empresaId), {
            workerSsw: opcoes.workerSsw,
            agora: opcoes.agora,
            aoFalhar: (erro, empresaId) => {
              request.log.warn({ err: erro, empresaId }, "números do Dashboard não saíram");
            },
          }),
        ),
      ),
  );
  pronto();
};
