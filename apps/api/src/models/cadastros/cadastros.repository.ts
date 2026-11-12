import { type Transacao } from "@erp/db";
import { cargoPermissoes, cargos, empresaUsuarios } from "@erp/db/schema";
import { partesDaPermissao, type Permissao } from "@erp/shared/acesso/permissoes";
import { and, asc, count, eq } from "drizzle-orm";

import { type RepositorioCadastros } from "./cadastros.service";

export function criarRepositorioCadastros(tx: Transacao): RepositorioCadastros {
  async function permissoesPorCargo(empresaId: string, chave?: string) {
    const linhas = await tx
      .select({
        chave: cargoPermissoes.cargoChave,
        tela: cargoPermissoes.telaChave,
        acao: cargoPermissoes.acao,
      })
      .from(cargoPermissoes)
      .where(
        and(
          eq(cargoPermissoes.empresaId, empresaId),
          chave === undefined ? undefined : eq(cargoPermissoes.cargoChave, chave),
        ),
      );
    const porCargo = new Map<string, string[]>();
    for (const l of linhas) {
      porCargo.set(l.chave, [...(porCargo.get(l.chave) ?? []), `${l.tela}.${l.acao}`]);
    }
    return porCargo;
  }

  async function usoPorCargo(empresaId: string) {
    const linhas = await tx
      .select({ chave: empresaUsuarios.papel, total: count() })
      .from(empresaUsuarios)
      .where(eq(empresaUsuarios.empresaId, empresaId))
      .groupBy(empresaUsuarios.papel);
    return new Map(linhas.map((l) => [l.chave, l.total]));
  }

  async function trocarPermissoes(
    empresaId: string,
    chave: string,
    permissoes: readonly Permissao[],
  ) {
    await tx
      .delete(cargoPermissoes)
      .where(and(eq(cargoPermissoes.empresaId, empresaId), eq(cargoPermissoes.cargoChave, chave)));
    if (permissoes.length === 0) return;
    await tx.insert(cargoPermissoes).values(
      permissoes.map((p) => {
        const { tela, acao } = partesDaPermissao(p);
        return { empresaId, cargoChave: chave, telaChave: tela, acao };
      }),
    );
  }

  return {
    cargos: async (empresaId) => {
      const linhas = await tx
        .select({ chave: cargos.chave, rotulo: cargos.rotulo, protegido: cargos.protegido })
        .from(cargos)
        .where(eq(cargos.empresaId, empresaId))
        .orderBy(asc(cargos.criadoEm), asc(cargos.chave));
      const permissoes = await permissoesPorCargo(empresaId);
      const uso = await usoPorCargo(empresaId);
      return linhas.map((c) => ({
        ...c,
        permissoes: permissoes.get(c.chave) ?? [],
        usuarios: uso.get(c.chave) ?? 0,
      }));
    },

    cargo: async (empresaId, chave) => {
      const [linha] = await tx
        .select({ chave: cargos.chave, rotulo: cargos.rotulo, protegido: cargos.protegido })
        .from(cargos)
        .where(and(eq(cargos.empresaId, empresaId), eq(cargos.chave, chave)));
      if (!linha) return null;
      return {
        ...linha,
        permissoes: (await permissoesPorCargo(empresaId, chave)).get(chave) ?? [],
        usuarios: (await usoPorCargo(empresaId)).get(chave) ?? 0,
      };
    },

    criarCargo: async (empresaId, cargo, permissoes) => {
      await tx.insert(cargos).values({ empresaId, ...cargo });
      await trocarPermissoes(empresaId, cargo.chave, permissoes);
    },

    alterarCargo: async (empresaId, chave, rotulo) => {
      await tx
        .update(cargos)
        .set({ rotulo, atualizadoEm: new Date() })
        .where(and(eq(cargos.empresaId, empresaId), eq(cargos.chave, chave)));
    },

    trocarPermissoes,

    excluirCargo: async (empresaId, chave) => {
      await tx.delete(cargos).where(and(eq(cargos.empresaId, empresaId), eq(cargos.chave, chave)));
    },
  };
}
