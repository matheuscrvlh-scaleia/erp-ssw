import { type Transacao } from "@erp/db";
import {
  cargos,
  cargoTelas,
  departamentos,
  departamentoTelas,
  empresaUsuarios,
} from "@erp/db/schema";
import { ehTela, type Tela } from "@erp/shared/acesso/telas";
import { and, asc, count, eq } from "drizzle-orm";

import { type RepositorioCadastros } from "./casos-de-uso";

const soTelas = (linhas: { tela: string }[]): Tela[] =>
  linhas.flatMap((l) => (ehTela(l.tela) ? [l.tela] : []));

export function criarRepositorioCadastros(tx: Transacao): RepositorioCadastros {
  async function telasDoCargo(empresaId: string, chave: string) {
    return soTelas(
      await tx
        .select({ tela: cargoTelas.telaChave })
        .from(cargoTelas)
        .where(and(eq(cargoTelas.empresaId, empresaId), eq(cargoTelas.cargoChave, chave))),
    );
  }

  async function telasDoDepartamento(empresaId: string, chave: string) {
    return soTelas(
      await tx
        .select({ tela: departamentoTelas.telaChave })
        .from(departamentoTelas)
        .where(
          and(
            eq(departamentoTelas.empresaId, empresaId),
            eq(departamentoTelas.departamentoChave, chave),
          ),
        ),
    );
  }

  async function usoPorChave(empresaId: string, campo: "papel" | "departamento") {
    const coluna = campo === "papel" ? empresaUsuarios.papel : empresaUsuarios.departamentoChave;
    const linhas = await tx
      .select({ chave: coluna, total: count() })
      .from(empresaUsuarios)
      .where(eq(empresaUsuarios.empresaId, empresaId))
      .groupBy(coluna);
    return new Map(linhas.map((l) => [l.chave, l.total]));
  }

  async function trocarTelasDoCargo(empresaId: string, chave: string, telas: readonly Tela[]) {
    await tx
      .delete(cargoTelas)
      .where(and(eq(cargoTelas.empresaId, empresaId), eq(cargoTelas.cargoChave, chave)));
    if (telas.length === 0) return;
    await tx
      .insert(cargoTelas)
      .values(telas.map((telaChave) => ({ empresaId, cargoChave: chave, telaChave })));
  }

  async function trocarTelasDoDepartamento(
    empresaId: string,
    chave: string,
    telas: readonly Tela[],
  ) {
    await tx
      .delete(departamentoTelas)
      .where(
        and(
          eq(departamentoTelas.empresaId, empresaId),
          eq(departamentoTelas.departamentoChave, chave),
        ),
      );
    if (telas.length === 0) return;
    await tx
      .insert(departamentoTelas)
      .values(telas.map((telaChave) => ({ empresaId, departamentoChave: chave, telaChave })));
  }

  return {
    cargos: async (empresaId) => {
      const linhas = await tx
        .select()
        .from(cargos)
        .where(eq(cargos.empresaId, empresaId))
        .orderBy(asc(cargos.criadoEm), asc(cargos.chave));
      const telas = await tx
        .select({ chave: cargoTelas.cargoChave, tela: cargoTelas.telaChave })
        .from(cargoTelas)
        .where(eq(cargoTelas.empresaId, empresaId));
      const uso = await usoPorChave(empresaId, "papel");
      return linhas.map((c) => ({
        chave: c.chave,
        rotulo: c.rotulo,
        protegido: c.protegido,
        telas: soTelas(telas.filter((t) => t.chave === c.chave)),
        usuarios: uso.get(c.chave) ?? 0,
      }));
    },

    cargo: async (empresaId, chave) => {
      const [linha] = await tx
        .select({ chave: cargos.chave, rotulo: cargos.rotulo, protegido: cargos.protegido })
        .from(cargos)
        .where(and(eq(cargos.empresaId, empresaId), eq(cargos.chave, chave)));
      return linha ? { ...linha, telas: await telasDoCargo(empresaId, chave) } : null;
    },

    criarCargo: async (empresaId, cargo, telas) => {
      await tx.insert(cargos).values({ empresaId, ...cargo });
      await trocarTelasDoCargo(empresaId, cargo.chave, telas);
    },

    alterarCargo: async (empresaId, chave, rotulo) => {
      await tx
        .update(cargos)
        .set({ rotulo, atualizadoEm: new Date() })
        .where(and(eq(cargos.empresaId, empresaId), eq(cargos.chave, chave)));
    },

    trocarTelasDoCargo,

    excluirCargo: async (empresaId, chave) => {
      await tx.delete(cargos).where(and(eq(cargos.empresaId, empresaId), eq(cargos.chave, chave)));
    },

    departamentos: async (empresaId) => {
      const linhas = await tx
        .select()
        .from(departamentos)
        .where(eq(departamentos.empresaId, empresaId))
        .orderBy(asc(departamentos.criadoEm), asc(departamentos.chave));
      const telas = await tx
        .select({ chave: departamentoTelas.departamentoChave, tela: departamentoTelas.telaChave })
        .from(departamentoTelas)
        .where(eq(departamentoTelas.empresaId, empresaId));
      const uso = await usoPorChave(empresaId, "departamento");
      return linhas.map((d) => ({
        chave: d.chave,
        rotulo: d.rotulo,
        descricao: d.descricao,
        ativo: d.ativo,
        protegido: d.protegido,
        telas: soTelas(telas.filter((t) => t.chave === d.chave)),
        usuarios: uso.get(d.chave) ?? 0,
      }));
    },

    departamento: async (empresaId, chave) => {
      const [linha] = await tx
        .select({
          chave: departamentos.chave,
          rotulo: departamentos.rotulo,
          descricao: departamentos.descricao,
          ativo: departamentos.ativo,
          protegido: departamentos.protegido,
        })
        .from(departamentos)
        .where(and(eq(departamentos.empresaId, empresaId), eq(departamentos.chave, chave)));
      return linha ? { ...linha, telas: await telasDoDepartamento(empresaId, chave) } : null;
    },

    criarDepartamento: async (empresaId, departamento, telas) => {
      await tx.insert(departamentos).values({ empresaId, ...departamento });
      await trocarTelasDoDepartamento(empresaId, departamento.chave, telas);
    },

    alterarDepartamento: async (empresaId, chave, dados) => {
      await tx
        .update(departamentos)
        .set({ ...dados, atualizadoEm: new Date() })
        .where(and(eq(departamentos.empresaId, empresaId), eq(departamentos.chave, chave)));
    },

    trocarTelasDoDepartamento,

    excluirDepartamento: async (empresaId, chave) => {
      await tx
        .delete(departamentos)
        .where(and(eq(departamentos.empresaId, empresaId), eq(departamentos.chave, chave)));
    },

    usuariosCom: async (empresaId, campo, chave) =>
      (await usoPorChave(empresaId, campo)).get(chave) ?? 0,
  };
}
