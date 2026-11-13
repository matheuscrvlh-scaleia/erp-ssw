import { comInstantes, sql, type Transacao } from "@erp/db";
import { PAPEL_ADMIN, PAPEL_SUPER_ADMIN } from "@erp/shared/access/roles";

import { type RepositorioAuth, type SessaoGravada } from "./auth.service";

type Retorno<K extends keyof RepositorioAuth> = Awaited<ReturnType<RepositorioAuth[K]>>;

export function criarRepositorioAuth(tx: Transacao): RepositorioAuth {
  return {
    usuarioPorEmail: async (email) => {
      const [linha] = comInstantes<NonNullable<Retorno<"usuarioPorEmail">>>(
        await tx.consultar(sql`
          select id, email, nome, ativo, senha_hash as "senhaHash",
                 senha_algoritmo as "senhaAlgoritmo", bloqueado_ate as "bloqueadoAte"
          from erp.usuarios where email = ${email}`),
        ["bloqueadoAte"],
      );
      return linha ?? null;
    },

    contarFalha: async (usuarioId) => {
      const [linha] = await tx.consultar<{ falhas: number }>(sql`
        update erp.usuarios set tentativas_falhas = tentativas_falhas + 1
        where id = ${usuarioId}
        returning tentativas_falhas as falhas`);
      return linha?.falhas ?? 0;
    },

    bloquear: async (usuarioId, ate) => {
      await tx.executar(
        sql`update erp.usuarios set bloqueado_ate = ${ate} where id = ${usuarioId}`,
      );
    },

    registrarEntrada: async (usuarioId, agora, novoHash) => {
      await tx.executar(sql`
        update erp.usuarios
        set tentativas_falhas = 0, bloqueado_ate = null, ultimo_login_em = ${agora}
            ${novoHash ? sql`, senha_hash = ${novoHash}, senha_algoritmo = 'argon2id'` : sql.vazio()}
        where id = ${usuarioId}`);
    },

    criarSessao: async (s) => {
      await tx.executar(sql`
        insert into erp.sessoes (usuario_id, familia_id, token_hash, empresa_ativa_id, criado_em,
                                 expira_em, ip, user_agent)
        values (${s.usuarioId}, ${s.familiaId}, ${s.tokenHash}, ${s.empresaAtivaId},
                ${s.criadoEm}, ${s.expiraEm}, ${s.ip}, ${s.userAgent})`);
    },

    sessaoPorHash: async (tokenHash) => {
      const [linha] = comInstantes<SessaoGravada>(
        await tx.consultar(sql`
          select id, usuario_id as "usuarioId", familia_id as "familiaId",
                 empresa_ativa_id as "empresaAtivaId", criado_em as "criadoEm",
                 expira_em as "expiraEm", substituida_em as "substituidaEm",
                 revogada_em as "revogadaEm"
          from erp.sessoes where token_hash = ${tokenHash}`),
        ["criadoEm", "expiraEm", "substituidaEm", "revogadaEm"],
      );
      return linha ?? null;
    },

    substituirSessao: async (sessaoId, agora) => {
      await tx.executar(sql`
        update erp.sessoes set substituida_em = ${agora}
        where id = ${sessaoId} and substituida_em is null`);
    },

    revogarFamilia: async (familiaId, motivo, agora) => {
      await tx.executar(sql`
        update erp.sessoes set revogada_em = ${agora}, motivo_revogacao = ${motivo}
        where familia_id = ${familiaId} and revogada_em is null`);
    },

    revogarSessoesDoUsuario: async (usuarioId, motivo, agora) => {
      await tx.executar(sql`
        update erp.sessoes set revogada_em = ${agora}, motivo_revogacao = ${motivo}
        where usuario_id = ${usuarioId} and revogada_em is null`);
    },

    trocarEmpresaDaFamilia: async (familiaId, empresaId) => {
      await tx.executar(sql`
        update erp.sessoes set empresa_ativa_id = ${empresaId}
        where familia_id = ${familiaId} and revogada_em is null`);
    },

    definirEmpresaPreferida: async (usuarioId, empresaId) => {
      await tx.executar(sql`
        update erp.usuarios set empresa_preferida_id = ${empresaId} where id = ${usuarioId}`);
    },

    emitirTokenSenha: async (novo, agora) => {
      await tx.executar(sql`
        update erp.tokens_senha set usado_em = ${agora}
        where usuario_id = ${novo.usuarioId} and tipo = ${novo.tipo} and usado_em is null`);
      await tx.executar(sql`
        insert into erp.tokens_senha (usuario_id, tipo, token_hash, expira_em)
        values (${novo.usuarioId}, ${novo.tipo}, ${novo.tokenHash}, ${novo.expiraEm})`);
    },

    tokenSenhaPorHash: async (tokenHash, tipo) => {
      const [linha] = comInstantes<NonNullable<Retorno<"tokenSenhaPorHash">>>(
        await tx.consultar(sql`
          select t.id, t.usuario_id as "usuarioId", u.email as "usuarioEmail",
                 t.expira_em as "expiraEm", t.usado_em as "usadoEm"
          from erp.tokens_senha t
          join erp.usuarios u on u.id = t.usuario_id
          where t.token_hash = ${tokenHash} and t.tipo = ${tipo}`),
        ["expiraEm", "usadoEm"],
      );
      return linha ?? null;
    },

    consumirTokenSenha: async (tokenId, agora) => {
      const alteradas = await tx.executar(sql`
        update erp.tokens_senha set usado_em = ${agora}
        where id = ${tokenId} and usado_em is null`);
      return alteradas > 0;
    },

    definirSenha: async (usuarioId, hash, nome) => {
      await tx.executar(sql`
        update erp.usuarios
        set senha_hash = ${hash}, senha_algoritmo = 'argon2id', tentativas_falhas = 0,
            bloqueado_ate = null, atualizado_em = now()
            ${nome ? sql`, nome = ${nome}` : sql.vazio()}
        where id = ${usuarioId}`);
    },

    adminsDaEmpresa: (empresaId) =>
      tx.consultar(sql`
        select u.nome, u.email
        from erp.empresa_usuarios eu
        join erp.usuarios u on u.id = eu.usuario_id
        where eu.empresa_id = ${empresaId} and eu.ativo and u.ativo
          and eu.papel = any(${[PAPEL_ADMIN, PAPEL_SUPER_ADMIN]}::text[])
        order by u.nome`),
  };
}
