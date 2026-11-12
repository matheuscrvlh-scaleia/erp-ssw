import { type Transacao } from "@erp/db";
import { empresaUsuarios, sessoes, tokensSenha, usuarios } from "@erp/db/schema";
import { PAPEL_ADMIN, PAPEL_SUPER_ADMIN } from "@erp/shared/acesso/papeis";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import { type RepositorioAuth } from "./casos-de-uso";

export function criarRepositorioAuth(tx: Transacao): RepositorioAuth {
  return {
    usuarioPorEmail: async (email) => {
      const [linha] = await tx
        .select({
          id: usuarios.id,
          email: usuarios.email,
          nome: usuarios.nome,
          ativo: usuarios.ativo,
          senhaHash: usuarios.senhaHash,
          senhaAlgoritmo: usuarios.senhaAlgoritmo,
          bloqueadoAte: usuarios.bloqueadoAte,
        })
        .from(usuarios)
        .where(eq(usuarios.email, email));
      return linha ?? null;
    },

    contarFalha: async (usuarioId) => {
      const [linha] = await tx
        .update(usuarios)
        .set({ tentativasFalhas: sql`${usuarios.tentativasFalhas} + 1` })
        .where(eq(usuarios.id, usuarioId))
        .returning({ falhas: usuarios.tentativasFalhas });
      return linha?.falhas ?? 0;
    },

    bloquear: async (usuarioId, ate) => {
      await tx.update(usuarios).set({ bloqueadoAte: ate }).where(eq(usuarios.id, usuarioId));
    },

    registrarEntrada: async (usuarioId, agora, novoHash) => {
      await tx
        .update(usuarios)
        .set({
          tentativasFalhas: 0,
          bloqueadoAte: null,
          ultimoLoginEm: agora,
          ...(novoHash ? { senhaHash: novoHash, senhaAlgoritmo: "argon2id" as const } : {}),
        })
        .where(eq(usuarios.id, usuarioId));
    },

    criarSessao: async (sessao) => {
      await tx.insert(sessoes).values(sessao);
    },

    sessaoPorHash: async (tokenHash) => {
      const [linha] = await tx
        .select({
          id: sessoes.id,
          usuarioId: sessoes.usuarioId,
          familiaId: sessoes.familiaId,
          empresaAtivaId: sessoes.empresaAtivaId,
          criadoEm: sessoes.criadoEm,
          expiraEm: sessoes.expiraEm,
          substituidaEm: sessoes.substituidaEm,
          revogadaEm: sessoes.revogadaEm,
        })
        .from(sessoes)
        .where(eq(sessoes.tokenHash, tokenHash));
      return linha ?? null;
    },

    substituirSessao: async (sessaoId, agora) => {
      await tx
        .update(sessoes)
        .set({ substituidaEm: agora })
        .where(and(eq(sessoes.id, sessaoId), isNull(sessoes.substituidaEm)));
    },

    revogarFamilia: async (familiaId, motivo, agora) => {
      await tx
        .update(sessoes)
        .set({ revogadaEm: agora, motivoRevogacao: motivo })
        .where(and(eq(sessoes.familiaId, familiaId), isNull(sessoes.revogadaEm)));
    },

    revogarSessoesDoUsuario: async (usuarioId, motivo, agora) => {
      await tx
        .update(sessoes)
        .set({ revogadaEm: agora, motivoRevogacao: motivo })
        .where(and(eq(sessoes.usuarioId, usuarioId), isNull(sessoes.revogadaEm)));
    },

    trocarEmpresaDaFamilia: async (familiaId, empresaId) => {
      await tx
        .update(sessoes)
        .set({ empresaAtivaId: empresaId })
        .where(and(eq(sessoes.familiaId, familiaId), isNull(sessoes.revogadaEm)));
    },

    definirEmpresaPreferida: async (usuarioId, empresaId) => {
      await tx
        .update(usuarios)
        .set({ empresaPreferidaId: empresaId })
        .where(eq(usuarios.id, usuarioId));
    },

    emitirTokenSenha: async (novo, agora) => {
      await tx
        .update(tokensSenha)
        .set({ usadoEm: agora })
        .where(
          and(
            eq(tokensSenha.usuarioId, novo.usuarioId),
            eq(tokensSenha.tipo, novo.tipo),
            isNull(tokensSenha.usadoEm),
          ),
        );
      await tx.insert(tokensSenha).values(novo);
    },

    tokenSenhaPorHash: async (tokenHash, tipo) => {
      const [linha] = await tx
        .select({
          id: tokensSenha.id,
          usuarioId: tokensSenha.usuarioId,
          usuarioEmail: usuarios.email,
          expiraEm: tokensSenha.expiraEm,
          usadoEm: tokensSenha.usadoEm,
        })
        .from(tokensSenha)
        .innerJoin(usuarios, eq(usuarios.id, tokensSenha.usuarioId))
        .where(and(eq(tokensSenha.tokenHash, tokenHash), eq(tokensSenha.tipo, tipo)));
      return linha ?? null;
    },

    consumirTokenSenha: async (tokenId, agora) => {
      const linhas = await tx
        .update(tokensSenha)
        .set({ usadoEm: agora })
        .where(and(eq(tokensSenha.id, tokenId), isNull(tokensSenha.usadoEm)))
        .returning({ id: tokensSenha.id });
      return linhas.length > 0;
    },

    definirSenha: async (usuarioId, hash, nome) => {
      await tx
        .update(usuarios)
        .set({
          senhaHash: hash,
          senhaAlgoritmo: "argon2id",
          tentativasFalhas: 0,
          bloqueadoAte: null,
          atualizadoEm: sql`now()`,
          ...(nome ? { nome } : {}),
        })
        .where(eq(usuarios.id, usuarioId));
    },

    adminsDaEmpresa: (empresaId) =>
      tx
        .select({ nome: usuarios.nome, email: usuarios.email })
        .from(empresaUsuarios)
        .innerJoin(usuarios, eq(usuarios.id, empresaUsuarios.usuarioId))
        .where(
          and(
            eq(empresaUsuarios.empresaId, empresaId),
            eq(empresaUsuarios.ativo, true),
            eq(usuarios.ativo, true),
            inArray(empresaUsuarios.papel, [PAPEL_ADMIN, PAPEL_SUPER_ADMIN]),
          ),
        )
        .orderBy(asc(usuarios.nome)),
  };
}
