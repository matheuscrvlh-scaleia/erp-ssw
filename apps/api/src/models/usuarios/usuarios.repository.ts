import { sql, type Transacao, valoresDeInsercao } from "@erp/db";
import { type ExcecaoDePermissao } from "@erp/dominio/acesso";
import { ehPermissao, partesDaPermissao } from "@erp/shared/acesso/permissoes";

import { type ContaGravada, type RepositorioUsuarios } from "./usuarios.service";

const SELECT_CONTA = sql`
  select id, email, nome, ativo, senha_hash is not null as "temSenha" from erp.usuarios`;

export function criarRepositorioUsuarios(tx: Transacao): RepositorioUsuarios {
  return {
    listar: (empresaId) =>
      tx.consultar(sql`
        select u.id, u.nome, u.email, u.senha_hash is not null as "temSenha",
               u.ativo as "contaAtiva", eu.papel, eu.ativo
        from erp.empresa_usuarios eu
        join erp.usuarios u on u.id = eu.usuario_id
        where eu.empresa_id = ${empresaId}
        order by u.criado_em, u.id`),

    excecoes: async (empresaId) => {
      const linhas = await tx.consultar<{
        usuarioId: string;
        tela: string;
        acao: string;
        efeito: ExcecaoDePermissao["efeito"];
      }>(sql`
        select usuario_id as "usuarioId", tela_chave as tela, acao, efeito
        from erp.usuario_permissoes where empresa_id = ${empresaId}`);
      return linhas.map((l) => ({
        usuarioId: l.usuarioId,
        permissao: `${l.tela}.${l.acao}`,
        efeito: l.efeito,
      }));
    },

    contaPorEmail: async (email) => {
      const [linha] = await tx.consultar<ContaGravada>(sql`${SELECT_CONTA} where email = ${email}`);
      return linha ?? null;
    },

    conta: async (usuarioId) => {
      const [linha] = await tx.consultar<ContaGravada>(
        sql`${SELECT_CONTA} where id = ${usuarioId}`,
      );
      return linha ?? null;
    },

    vinculo: async (empresaId, usuarioId) => {
      const [linha] = await tx.consultar<{ papel: string | null; ativo: boolean }>(sql`
        select papel, ativo from erp.empresa_usuarios
        where empresa_id = ${empresaId} and usuario_id = ${usuarioId}`);
      return linha ?? null;
    },

    vinculosEmTodasAsEmpresas: (usuarioId) =>
      tx.consultar(sql`
        select empresa_id as "empresaId", papel from erp.empresa_usuarios
        where usuario_id = ${usuarioId}`),

    existeCargo: async (empresaId, chave) => {
      const linhas = await tx.consultar(sql`
        select 1 from erp.cargos where empresa_id = ${empresaId} and chave = ${chave}`);
      return linhas.length > 0;
    },

    criarConta: async (conta) => {
      const [linha] = await tx.consultar<{ id: string }>(sql`
        insert into erp.usuarios (email, nome, senha_hash, senha_algoritmo, empresa_preferida_id)
        values (${conta.email}, ${conta.nome}, ${conta.senhaHash},
                ${conta.senhaHash ? "argon2id" : null}, ${conta.empresaPreferidaId})
        returning id`);
      if (!linha) throw new Error("insert de usuário sem retorno");
      return linha.id;
    },

    alterarConta: async (usuarioId, dados) => {
      await tx.executar(sql`
        update erp.usuarios
        set nome = ${dados.nome}, email = ${dados.email}, ativo = ${dados.ativo},
            atualizado_em = now()
        where id = ${usuarioId}`);
    },

    gravarVinculo: async (empresaId, usuarioId, vinculo, criadoPor) => {
      await tx.executar(sql`
        insert into erp.empresa_usuarios (empresa_id, usuario_id, criado_por, papel, ativo)
        values (${empresaId}, ${usuarioId}, ${criadoPor}, ${vinculo.papel}, ${vinculo.ativo})
        on conflict (empresa_id, usuario_id) do update
        set papel = excluded.papel, ativo = excluded.ativo`);
    },

    definirPreferidaSeVazia: async (usuarioId, empresaId) => {
      await tx.executar(sql`
        update erp.usuarios set empresa_preferida_id = ${empresaId}
        where id = ${usuarioId} and empresa_preferida_id is null`);
    },

    trocarExcecoes: async (empresaId, usuarioId, excecoes, criadoPor) => {
      await tx.executar(sql`
        delete from erp.usuario_permissoes
        where empresa_id = ${empresaId} and usuario_id = ${usuarioId}`);
      const linhas = excecoes.flatMap((e) => {
        if (!ehPermissao(e.permissao)) return [];
        const { tela, acao } = partesDaPermissao(e.permissao);
        return [{ empresaId, usuarioId, telaChave: tela, acao, efeito: e.efeito, criadoPor }];
      });
      if (linhas.length > 0) {
        await tx.executar(sql`insert into erp.usuario_permissoes ${valoresDeInsercao(linhas)}`);
      }
    },
  };
}
