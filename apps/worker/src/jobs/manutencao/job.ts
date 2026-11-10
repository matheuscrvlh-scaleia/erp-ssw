import { z } from "@erp/shared/zod";

import { definirJob } from "../registro";

export interface RepositorioManutencao {
  /** Apaga sessões que venceram ou foram revogadas antes de `limite`; devolve quantas. */
  apagarSessoesEncerradas(limite: Date): Promise<number>;
  /** Apaga links de senha/convite vencidos antes de `limite`; devolve quantos. */
  apagarTokensDeSenhaVencidos(limite: Date): Promise<number>;
}

/** Guarda uma semana depois do fim, para dar para investigar um reuso de refresh. */
const RETENCAO_MS = 7 * 24 * 60 * 60_000;

/**
 * Job de exemplo (e útil): limpa sessões e links de senha que já não valem. Escopo Plataforma,
 * todo dia às 3h.
 */
export const limparSessoes = definirJob({
  nome: "limpar-sessoes",
  fila: "manutencao",
  escopo: "plataforma",
  dados: z.object({}),
  agendamento: "0 3 * * *",
  async processar({ executar, agora, log }) {
    const limite = new Date(agora().getTime() - RETENCAO_MS);
    const apagados = await executar(async ({ manutencao }) => ({
      sessoes: await manutencao.apagarSessoesEncerradas(limite),
      tokens: await manutencao.apagarTokensDeSenhaVencidos(limite),
    }));
    log.info(apagados, "sessões e links de senha vencidos apagados");
  },
});
