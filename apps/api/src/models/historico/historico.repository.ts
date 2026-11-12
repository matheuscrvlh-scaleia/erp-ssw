import { atribuicoes, sql, type Transacao, valoresDeInsercao } from "@erp/db";

import { type RepositorioHistorico } from "./historico.service";

type Retorno<K extends keyof RepositorioHistorico> = Awaited<ReturnType<RepositorioHistorico[K]>>;

export function criarRepositorioHistorico(tx: Transacao): RepositorioHistorico {
  return {
    anotacoes: async (empresaId, filtro, limite) => {
      const linhas = await tx.consultar<Retorno<"anotacoes">[number]>(sql`
        select a.id, a.data, a.tipo, a.texto, a.autor_id as "autorId", u.nome as "autorNome",
               a.unidade_id as "unidadeId", un.nome as "unidadeNome", a.criado_em as "criadoEm"
        from erp.anotacoes a
        left join erp.usuarios u on u.id = a.autor_id
        left join erp.unidades un on un.id = a.unidade_id
        where a.empresa_id = ${empresaId}
          and a.data between ${filtro.inicio} and ${filtro.fim}
          ${filtro.unidades.length > 0 ? sql`and a.unidade_id = any(${filtro.unidades}::uuid[])` : sql.vazio()}
        order by a.data desc, a.criado_em desc
        limit ${limite}`);
      return linhas.map((l) => ({ ...l, criadoEm: new Date(l.criadoEm).toISOString() }));
    },

    feriados: (empresaId, filtro, limite) =>
      tx.consultar(sql`
        select id, empresa_id as "empresaId", data, tipo, cidade, uf, descricao,
               gerado_automaticamente as "geradoAutomaticamente"
        from erp.feriados
        where (empresa_id is null or empresa_id = ${empresaId})
          and data between ${filtro.de} and ${filtro.ate}
          ${filtro.tipo ? sql`and tipo = ${filtro.tipo}` : sql.vazio()}
          ${filtro.uf ? sql`and uf = ${filtro.uf}` : sql.vazio()}
        order by data desc
        limit ${limite}`),

    unidadesAtivas: (empresaId) =>
      tx.consultar(sql`
        select id, nome from erp.unidades
        where empresa_id = ${empresaId} and ativo
        order by nome`),

    unidadeDaEmpresa: async (empresaId, unidadeId) => {
      const linhas = await tx.consultar(sql`
        select 1 from erp.unidades where empresa_id = ${empresaId} and id = ${unidadeId}`);
      return linhas.length > 0;
    },

    autores: (empresaId) =>
      tx.consultar(sql`
        select u.id, u.nome
        from erp.empresa_usuarios eu
        join erp.usuarios u on u.id = eu.usuario_id
        where eu.empresa_id = ${empresaId} and u.nome is not null
        order by u.nome`),

    anotacao: async (empresaId, id) => {
      const [linha] = await tx.consultar<NonNullable<Retorno<"anotacao">>>(sql`
        select id, data, tipo, texto, autor_id as "autorId", unidade_id as "unidadeId"
        from erp.anotacoes
        where empresa_id = ${empresaId} and id = ${id}`);
      return linha ?? null;
    },

    criarAnotacao: async (nova) => {
      const [linha] = await tx.consultar<{ id: string }>(sql`
        insert into erp.anotacoes ${valoresDeInsercao([nova])} returning id`);
      if (!linha) throw new Error("insert de anotação não devolveu o id");
      return linha.id;
    },

    alterarAnotacao: async (id, dados, agora) => {
      await tx.executar(sql`
        update erp.anotacoes set ${atribuicoes({ ...dados, atualizadoEm: agora })}
        where id = ${id}`);
    },

    excluirAnotacao: async (id) => {
      await tx.executar(sql`delete from erp.anotacoes where id = ${id}`);
    },
  };
}
