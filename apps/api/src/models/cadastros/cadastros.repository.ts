import { sql, type Transacao, valoresDeInsercao } from "@erp/db";
import { partesDaPermissao, type Permissao } from "@erp/shared/acesso/permissoes";

import { type RepositorioCadastros } from "./cadastros.service";

interface CargoLido {
  chave: string;
  rotulo: string;
  protegido: boolean;
}

export function criarRepositorioCadastros(tx: Transacao): RepositorioCadastros {
  async function permissoesPorCargo(empresaId: string, chave?: string) {
    const linhas = await tx.consultar<{ chave: string; tela: string; acao: string }>(sql`
      select cargo_chave as chave, tela_chave as tela, acao
      from erp.cargo_permissoes
      where empresa_id = ${empresaId}
        ${chave === undefined ? sql.vazio() : sql`and cargo_chave = ${chave}`}`);
    const porCargo = new Map<string, string[]>();
    for (const l of linhas) {
      porCargo.set(l.chave, [...(porCargo.get(l.chave) ?? []), `${l.tela}.${l.acao}`]);
    }
    return porCargo;
  }

  async function usoPorCargo(empresaId: string) {
    const linhas = await tx.consultar<{ chave: string; total: number }>(sql`
      select papel as chave, count(*)::int as total
      from erp.empresa_usuarios where empresa_id = ${empresaId}
      group by papel`);
    return new Map(linhas.map((l) => [l.chave, l.total]));
  }

  async function trocarPermissoes(
    empresaId: string,
    chave: string,
    permissoes: readonly Permissao[],
  ) {
    await tx.executar(sql`
      delete from erp.cargo_permissoes where empresa_id = ${empresaId} and cargo_chave = ${chave}`);
    if (permissoes.length === 0) return;
    const linhas = permissoes.map((p) => {
      const { tela, acao } = partesDaPermissao(p);
      return { empresaId, cargoChave: chave, telaChave: tela, acao };
    });
    await tx.executar(sql`insert into erp.cargo_permissoes ${valoresDeInsercao(linhas)}`);
  }

  return {
    cargos: async (empresaId) => {
      const linhas = await tx.consultar<CargoLido>(sql`
        select chave, rotulo, protegido from erp.cargos
        where empresa_id = ${empresaId}
        order by criado_em, chave`);
      const permissoes = await permissoesPorCargo(empresaId);
      const uso = await usoPorCargo(empresaId);
      return linhas.map((c) => ({
        ...c,
        permissoes: permissoes.get(c.chave) ?? [],
        usuarios: uso.get(c.chave) ?? 0,
      }));
    },

    cargo: async (empresaId, chave) => {
      const [linha] = await tx.consultar<CargoLido>(sql`
        select chave, rotulo, protegido from erp.cargos
        where empresa_id = ${empresaId} and chave = ${chave}`);
      if (!linha) return null;
      return {
        ...linha,
        permissoes: (await permissoesPorCargo(empresaId, chave)).get(chave) ?? [],
        usuarios: (await usoPorCargo(empresaId)).get(chave) ?? 0,
      };
    },

    criarCargo: async (empresaId, cargo, permissoes) => {
      await tx.executar(
        sql`insert into erp.cargos ${valoresDeInsercao([{ empresaId, ...cargo }])}`,
      );
      await trocarPermissoes(empresaId, cargo.chave, permissoes);
    },

    alterarCargo: async (empresaId, chave, rotulo) => {
      await tx.executar(sql`
        update erp.cargos set rotulo = ${rotulo}, atualizado_em = now()
        where empresa_id = ${empresaId} and chave = ${chave}`);
    },

    trocarPermissoes,

    excluirCargo: async (empresaId, chave) => {
      await tx.executar(sql`
        delete from erp.cargos where empresa_id = ${empresaId} and chave = ${chave}`);
    },
  };
}
