import { comInstantes, sql, type Transacao } from "@erp/db";
import { type ExcecaoDePermissao } from "@erp/domain/access";

import {
  type EmpresaGravada,
  type RepositorioAcesso,
  type UsuarioDoAcesso,
  type VinculoDetalhado,
} from "./access.service";

const permissoesDasLinhas = (linhas: { tela: string; acao: string }[]) =>
  linhas.map((p) => `${p.tela}.${p.acao}`);

export function criarRepositorioAcesso(tx: Transacao): RepositorioAcesso {
  return {
    usuario: async (usuarioId) => {
      const [linha] = await tx.consultar<UsuarioDoAcesso>(sql`
        select id, email, nome, ativo, empresa_preferida_id as "empresaPreferidaId"
        from erp.usuarios where id = ${usuarioId}`);
      return linha ?? null;
    },

    ehAdminPlataforma: async (usuarioId) => {
      const linhas = await tx.consultar(sql`
        select 1 from erp.plataforma_admins where usuario_id = ${usuarioId}`);
      return linhas.length > 0;
    },

    vinculos: async (usuarioId) =>
      comInstantes<VinculoDetalhado>(
        await tx.consultar(sql`
          select eu.empresa_id as "empresaId", e.nome as "empresaNome",
                 e.status as "empresaStatus", eu.papel, eu.ativo, eu.criado_em as "criadoEm"
          from erp.empresa_usuarios eu
          join erp.empresas e on e.id = eu.empresa_id
          where eu.usuario_id = ${usuarioId}`),
        ["criadoEm"],
      ),

    familiaAtiva: async (familiaId, agora) => {
      const linhas = await tx.consultar(sql`
        select 1 from erp.sessoes
        where familia_id = ${familiaId} and revogada_em is null and expira_em > ${agora}
        limit 1`);
      return linhas.length > 0;
    },

    empresa: async (empresaId) => {
      const [linha] = await tx.consultar<EmpresaGravada>(sql`
        select id, nome, nome_curto as "nomeCurto", logo_caminho as "logoCaminho",
               favicon_caminho as "faviconCaminho",
               cor_primaria as "corPrimaria", cor_destaque as "corDestaque", slogan, fuso, status
        from erp.empresas where id = ${empresaId}`);
      return linha ?? null;
    },

    todasAsEmpresas: () => tx.consultar(sql`select id, nome from erp.empresas order by nome`),

    cargo: async (empresaId, papel) => {
      const [linha] = await tx.consultar<{ rotulo: string }>(sql`
        select rotulo from erp.cargos where empresa_id = ${empresaId} and chave = ${papel}`);
      if (!linha) return null;
      const permissoes = await tx.consultar<{ tela: string; acao: string }>(sql`
        select tela_chave as tela, acao from erp.cargo_permissoes
        where empresa_id = ${empresaId} and cargo_chave = ${papel}`);
      return { rotulo: linha.rotulo, permissoes: permissoesDasLinhas(permissoes) };
    },

    cargoDaPlataforma: async (usuarioId) => {
      const [linha] = await tx.consultar<{ chave: string }>(sql`
        select cargo as chave from erp.plataforma_admins where usuario_id = ${usuarioId}`);
      if (!linha) return null;
      const permissoes = await tx.consultar<{ tela: string; acao: string }>(sql`
        select tela_chave as tela, acao from erp.plataforma_cargo_permissoes
        where cargo_chave = ${linha.chave}`);
      return { chave: linha.chave, permissoes: permissoesDasLinhas(permissoes) };
    },

    excecoes: async (empresaId, usuarioId) => {
      const linhas = await tx.consultar<{
        tela: string;
        acao: string;
        efeito: ExcecaoDePermissao["efeito"];
      }>(sql`
        select tela_chave as tela, acao, efeito from erp.usuario_permissoes
        where empresa_id = ${empresaId} and usuario_id = ${usuarioId}`);
      return linhas.map((l) => ({ permissao: `${l.tela}.${l.acao}`, efeito: l.efeito }));
    },

    liberacoes: (empresaId) =>
      tx.consultar(sql`
        select modulo_chave as modulo, ativo, inicio, fim
        from erp.empresa_modulos where empresa_id = ${empresaId}`),
  };
}
