import { sql, type Transacao } from "@erp/db";

import { type RepositorioManutencao } from "./maintenance.service";

export function criarRepositorioManutencao(tx: Transacao): RepositorioManutencao {
  return {
    apagarSessoesEncerradas: (limite) =>
      tx.executar(sql`
        delete from erp.sessoes where expira_em < ${limite} or revogada_em < ${limite}`),
    apagarTokensDeSenhaVencidos: (limite) =>
      tx.executar(sql`delete from erp.tokens_senha where expira_em < ${limite}`),
  };
}
