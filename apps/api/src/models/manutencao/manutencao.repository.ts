import { type Transacao } from "@erp/db";
import { sessoes, tokensSenha } from "@erp/db/schema";
import { lt, or } from "drizzle-orm";

import { type RepositorioManutencao } from "./manutencao.service";

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
  };
}
