import { type Transacao } from "@erp/db";
import {
  bi2Bruto,
  bi2Sincronizacoes,
  sessoes,
  sswSincronizacoes,
  sswWebhookEventos,
  tokensSenha,
} from "@erp/db/schema";
import { lt, or } from "drizzle-orm";

import { type RepositorioManutencao } from "./job";

export function criarRepositorioManutencao(tx: Transacao): RepositorioManutencao {
  return {
    apagarSessoesEncerradas: async (limite) => {
      const apagadas = await tx
        .delete(sessoes)
        .where(or(lt(sessoes.expiraEm, limite), lt(sessoes.revogadaEm, limite)))
        .returning({ id: sessoes.id });
      return apagadas.length;
    },
    apagarTokensDeSenhaVencidos: async (limite) => {
      const apagados = await tx
        .delete(tokensSenha)
        .where(lt(tokensSenha.expiraEm, limite))
        .returning({ id: tokensSenha.id });
      return apagados.length;
    },
    apagarIngestaoSswAntiga: async ({ registrosSsw, bi2 }) => {
      const contar = async (consulta: Promise<unknown[]>) => (await consulta).length;
      return {
        ssw_webhook_eventos: await contar(
          tx
            .delete(sswWebhookEventos)
            .where(lt(sswWebhookEventos.recebidoEm, registrosSsw))
            .returning({ id: sswWebhookEventos.id }),
        ),
        ssw_sincronizacoes: await contar(
          tx
            .delete(sswSincronizacoes)
            .where(lt(sswSincronizacoes.executadoEm, registrosSsw))
            .returning({ id: sswSincronizacoes.id }),
        ),
        bi2_sincronizacoes: await contar(
          tx
            .delete(bi2Sincronizacoes)
            .where(lt(bi2Sincronizacoes.iniciadoEm, bi2))
            .returning({ id: bi2Sincronizacoes.id }),
        ),
        bi2_bruto: await contar(
          tx
            .delete(bi2Bruto)
            .where(lt(bi2Bruto.atualizadoEm, bi2))
            .returning({ numero: bi2Bruto.numero }),
        ),
      };
    },
  };
}
