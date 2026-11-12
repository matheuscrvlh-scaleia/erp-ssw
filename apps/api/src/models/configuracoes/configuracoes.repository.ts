import { instanteDoBanco, sql, type Transacao } from "@erp/db";

import { type RepositorioConfiguracoes } from "./configuracoes.service";
import { type LeitorDeConfiguracoes } from "./leitor";

export function criarRepositorioConfiguracoes(
  tx: Transacao,
  configuracoesVigentes: LeitorDeConfiguracoes,
): RepositorioConfiguracoes {
  return {
    daEmpresa: async (empresaId, grupos) => {
      const linhas = await tx.consultar<{
        chave: string;
        valor: string;
        descricao: string;
        grupo: string;
        atualizadoEm: string;
      }>(sql`
        select chave, valor, descricao, grupo, atualizado_em as "atualizadoEm"
        from erp.configuracoes
        where empresa_id = ${empresaId} and grupo = any(${[...grupos]}::text[])`);
      return linhas.map((l) => ({ ...l, atualizadoEm: instanteDoBanco(l.atualizadoEm) }));
    },

    vigentes: configuracoesVigentes,

    gravarValor: async (empresaId, chave, valor, atualizadoPor) => {
      await tx.executar(sql`
        update erp.configuracoes
        set valor = ${valor}, atualizado_por = ${atualizadoPor}, atualizado_em = now()
        where empresa_id = ${empresaId} and chave = ${chave}`);
    },
  };
}
