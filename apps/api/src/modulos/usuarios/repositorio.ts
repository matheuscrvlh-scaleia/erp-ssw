import { type Transacao } from "@erp/db";
import { cargos, empresaUsuarios, usuarioPermissoes, usuarios } from "@erp/db/schema";
import { ehPermissao, partesDaPermissao } from "@erp/shared/acesso/permissoes";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { type ContaGravada, type RepositorioUsuarios } from "./casos-de-uso";

const temSenha = sql<boolean>`${usuarios.senhaHash} is not null`;

const colunasDaConta = {
  id: usuarios.id,
  email: usuarios.email,
  nome: usuarios.nome,
  ativo: usuarios.ativo,
  temSenha,
};

export function criarRepositorioUsuarios(tx: Transacao): RepositorioUsuarios {
  return {
    listar: (empresaId) =>
      tx
        .select({
          id: usuarios.id,
          nome: usuarios.nome,
          email: usuarios.email,
          temSenha,
          contaAtiva: usuarios.ativo,
          papel: empresaUsuarios.papel,
          ativo: empresaUsuarios.ativo,
        })
        .from(empresaUsuarios)
        .innerJoin(usuarios, eq(usuarios.id, empresaUsuarios.usuarioId))
        .where(eq(empresaUsuarios.empresaId, empresaId))
        .orderBy(asc(usuarios.criadoEm), asc(usuarios.id)),

    excecoes: async (empresaId) => {
      const linhas = await tx
        .select({
          usuarioId: usuarioPermissoes.usuarioId,
          tela: usuarioPermissoes.telaChave,
          acao: usuarioPermissoes.acao,
          efeito: usuarioPermissoes.efeito,
        })
        .from(usuarioPermissoes)
        .where(eq(usuarioPermissoes.empresaId, empresaId));
      return linhas.map((l) => ({
        usuarioId: l.usuarioId,
        permissao: `${l.tela}.${l.acao}`,
        efeito: l.efeito,
      }));
    },

    contaPorEmail: async (email): Promise<ContaGravada | null> => {
      const [linha] = await tx
        .select(colunasDaConta)
        .from(usuarios)
        .where(eq(usuarios.email, email));
      return linha ?? null;
    },

    conta: async (usuarioId): Promise<ContaGravada | null> => {
      const [linha] = await tx
        .select(colunasDaConta)
        .from(usuarios)
        .where(eq(usuarios.id, usuarioId));
      return linha ?? null;
    },

    vinculo: async (empresaId, usuarioId) => {
      const [linha] = await tx
        .select({
          papel: empresaUsuarios.papel,
          ativo: empresaUsuarios.ativo,
        })
        .from(empresaUsuarios)
        .where(
          and(eq(empresaUsuarios.empresaId, empresaId), eq(empresaUsuarios.usuarioId, usuarioId)),
        );
      return linha ?? null;
    },

    vinculosEmTodasAsEmpresas: (usuarioId) =>
      tx
        .select({ empresaId: empresaUsuarios.empresaId, papel: empresaUsuarios.papel })
        .from(empresaUsuarios)
        .where(eq(empresaUsuarios.usuarioId, usuarioId)),

    existeCargo: async (empresaId, chave) => {
      const linhas = await tx
        .select({ chave: cargos.chave })
        .from(cargos)
        .where(and(eq(cargos.empresaId, empresaId), eq(cargos.chave, chave)));
      return linhas.length > 0;
    },

    criarConta: async (conta) => {
      const [linha] = await tx
        .insert(usuarios)
        .values({
          email: conta.email,
          nome: conta.nome,
          senhaHash: conta.senhaHash,
          senhaAlgoritmo: conta.senhaHash ? "argon2id" : null,
          empresaPreferidaId: conta.empresaPreferidaId,
        })
        .returning({ id: usuarios.id });
      if (!linha) throw new Error("insert de usuário sem retorno");
      return linha.id;
    },

    alterarConta: async (usuarioId, dados) => {
      await tx
        .update(usuarios)
        .set({ ...dados, atualizadoEm: new Date() })
        .where(eq(usuarios.id, usuarioId));
    },

    gravarVinculo: async (empresaId, usuarioId, vinculo, criadoPor) => {
      const dados = { papel: vinculo.papel, ativo: vinculo.ativo };
      await tx
        .insert(empresaUsuarios)
        .values({ empresaId, usuarioId, criadoPor, ...dados })
        .onConflictDoUpdate({
          target: [empresaUsuarios.empresaId, empresaUsuarios.usuarioId],
          set: dados,
        });
    },

    definirPreferidaSeVazia: async (usuarioId, empresaId) => {
      await tx
        .update(usuarios)
        .set({ empresaPreferidaId: empresaId })
        .where(and(eq(usuarios.id, usuarioId), isNull(usuarios.empresaPreferidaId)));
    },

    trocarExcecoes: async (empresaId, usuarioId, excecoes, criadoPor) => {
      await tx
        .delete(usuarioPermissoes)
        .where(
          and(
            eq(usuarioPermissoes.empresaId, empresaId),
            eq(usuarioPermissoes.usuarioId, usuarioId),
          ),
        );
      const linhas = excecoes.flatMap((e) => {
        if (!ehPermissao(e.permissao)) return [];
        const { tela, acao } = partesDaPermissao(e.permissao);
        return [{ empresaId, usuarioId, telaChave: tela, acao, efeito: e.efeito, criadoPor }];
      });
      if (linhas.length > 0) await tx.insert(usuarioPermissoes).values(linhas);
    },
  };
}
