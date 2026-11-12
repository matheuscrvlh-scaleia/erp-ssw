import { type Transacao } from "@erp/db";
import {
  cargoPermissoes,
  cargos,
  empresaModulos,
  empresas,
  empresaUsuarios,
  plataformaAdmins,
  sessoes,
  usuarioPermissoes,
  usuarios,
} from "@erp/db/schema";
import { and, asc, eq, gt, isNull } from "drizzle-orm";

import { type RepositorioAcesso } from "./acesso.service";

export function criarRepositorioAcesso(tx: Transacao): RepositorioAcesso {
  return {
    usuario: async (usuarioId) => {
      const [linha] = await tx
        .select({
          id: usuarios.id,
          email: usuarios.email,
          nome: usuarios.nome,
          ativo: usuarios.ativo,
          empresaPreferidaId: usuarios.empresaPreferidaId,
        })
        .from(usuarios)
        .where(eq(usuarios.id, usuarioId));
      return linha ?? null;
    },

    ehAdminPlataforma: async (usuarioId) => {
      const linhas = await tx
        .select({ id: plataformaAdmins.usuarioId })
        .from(plataformaAdmins)
        .where(eq(plataformaAdmins.usuarioId, usuarioId));
      return linhas.length > 0;
    },

    vinculos: (usuarioId) =>
      tx
        .select({
          empresaId: empresaUsuarios.empresaId,
          empresaNome: empresas.nome,
          empresaStatus: empresas.status,
          papel: empresaUsuarios.papel,
          ativo: empresaUsuarios.ativo,
          criadoEm: empresaUsuarios.criadoEm,
        })
        .from(empresaUsuarios)
        .innerJoin(empresas, eq(empresas.id, empresaUsuarios.empresaId))
        .where(eq(empresaUsuarios.usuarioId, usuarioId)),

    familiaAtiva: async (familiaId, agora) => {
      const linhas = await tx
        .select({ id: sessoes.id })
        .from(sessoes)
        .where(
          and(
            eq(sessoes.familiaId, familiaId),
            isNull(sessoes.revogadaEm),
            gt(sessoes.expiraEm, agora),
          ),
        )
        .limit(1);
      return linhas.length > 0;
    },

    empresa: async (empresaId) => {
      const [linha] = await tx
        .select({
          id: empresas.id,
          nome: empresas.nome,
          nomeCurto: empresas.nomeCurto,
          logoCaminho: empresas.logoCaminho,
          corPrimaria: empresas.corPrimaria,
          corDestaque: empresas.corDestaque,
          slogan: empresas.slogan,
          fuso: empresas.fuso,
          status: empresas.status,
        })
        .from(empresas)
        .where(eq(empresas.id, empresaId));
      return linha ?? null;
    },

    todasAsEmpresas: () =>
      tx
        .select({ id: empresas.id, nome: empresas.nome })
        .from(empresas)
        .orderBy(asc(empresas.nome)),

    cargo: async (empresaId, papel) => {
      const [linha] = await tx
        .select({ rotulo: cargos.rotulo })
        .from(cargos)
        .where(and(eq(cargos.empresaId, empresaId), eq(cargos.chave, papel)));
      if (!linha) return null;
      const permissoes = await tx
        .select({ tela: cargoPermissoes.telaChave, acao: cargoPermissoes.acao })
        .from(cargoPermissoes)
        .where(
          and(eq(cargoPermissoes.empresaId, empresaId), eq(cargoPermissoes.cargoChave, papel)),
        );
      return { rotulo: linha.rotulo, permissoes: permissoes.map((p) => `${p.tela}.${p.acao}`) };
    },

    excecoes: async (empresaId, usuarioId) => {
      const linhas = await tx
        .select({
          tela: usuarioPermissoes.telaChave,
          acao: usuarioPermissoes.acao,
          efeito: usuarioPermissoes.efeito,
        })
        .from(usuarioPermissoes)
        .where(
          and(
            eq(usuarioPermissoes.empresaId, empresaId),
            eq(usuarioPermissoes.usuarioId, usuarioId),
          ),
        );
      return linhas.map((l) => ({ permissao: `${l.tela}.${l.acao}`, efeito: l.efeito }));
    },

    liberacoes: (empresaId) =>
      tx
        .select({
          modulo: empresaModulos.moduloChave,
          ativo: empresaModulos.ativo,
          inicio: empresaModulos.inicio,
          fim: empresaModulos.fim,
        })
        .from(empresaModulos)
        .where(eq(empresaModulos.empresaId, empresaId)),
  };
}
