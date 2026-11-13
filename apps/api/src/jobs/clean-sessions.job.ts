import { z } from "@erp/shared/zod";

import { limparSessoesEncerradas } from "../models/maintenance/maintenance.service";
import { definirJob } from "./registry";

/** Limpa sessões e links de senha que já não valem. Escopo Plataforma, todo dia às 3h. */
export const limparSessoes = definirJob({
  nome: "limpar-sessoes",
  fila: "manutencao",
  escopo: "plataforma",
  dados: z.object({}),
  agendamento: "0 3 * * *",
  async processar({ executar, agora, log }) {
    const apagados = await limparSessoesEncerradas(executar, agora());
    log.info(apagados, "sessões e links de senha vencidos apagados");
  },
});
