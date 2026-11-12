import { atribuicoes, comInstantes, sql, type Transacao, valoresDeInsercao } from "@erp/db";

import { type RegraGravada, type RepositorioPrazos } from "./prazos.service";

const SELECT_REGRA = sql`
  select id, tipo, unidade_codigo as "unidadeCodigo",
         unidade_destino_codigo as "unidadeDestinoCodigo", parceiro_cnpj as "parceiroCnpj",
         parceiro_nome as "parceiroNome", prazo_horas as "prazoHoras", prazo_dias as "prazoDias",
         ativo, criado_em as "criadoEm", atualizado_em as "atualizadoEm"
  from erp.prazos_configurados`;

const INSTANTES: (keyof RegraGravada)[] = ["criadoEm", "atualizadoEm"];

export function criarRepositorioPrazos(tx: Transacao): RepositorioPrazos {
  return {
    regras: async (empresaId) =>
      comInstantes<RegraGravada>(
        await tx.consultar(sql`${SELECT_REGRA} where empresa_id = ${empresaId}`),
        INSTANTES,
      ),

    regra: async (empresaId, id) => {
      const [linha] = comInstantes<RegraGravada>(
        await tx.consultar(sql`${SELECT_REGRA} where empresa_id = ${empresaId} and id = ${id}`),
        INSTANTES,
      );
      return linha ?? null;
    },

    criar: async (empresaId, dados) => {
      const [linha] = await tx.consultar<{ id: string }>(sql`
        insert into erp.prazos_configurados ${valoresDeInsercao([{ empresaId, ...dados }])}
        returning id`);
      if (!linha) throw new Error("insert de prazo sem retorno");
      return linha.id;
    },

    alterar: async (empresaId, id, dados) => {
      await tx.executar(sql`
        update erp.prazos_configurados set ${atribuicoes(dados)}, atualizado_em = now()
        where empresa_id = ${empresaId} and id = ${id}`);
    },

    ligar: async (empresaId, id, ativo) => {
      await tx.executar(sql`
        update erp.prazos_configurados set ativo = ${ativo}, atualizado_em = now()
        where empresa_id = ${empresaId} and id = ${id}`);
    },

    excluir: async (empresaId, id) => {
      await tx.executar(sql`
        delete from erp.prazos_configurados where empresa_id = ${empresaId} and id = ${id}`);
    },

    unidadesDosCtes: async (empresaId) => {
      const linhas = await tx.consultar<{ codigo: string; cidade: string | null }>(sql`
        select filial as codigo, max(nullif(btrim(unidade_cidade), '')) as cidade
        from erp.ctes
        where empresa_id = ${empresaId} and filial is not null and filial <> ''
        group by filial
        order by filial`);
      return linhas.flatMap((l) => (l.cidade ? [{ codigo: l.codigo, cidade: l.cidade }] : []));
    },

    parceirosDosCtes: async (empresaId) => {
      const linhas = await tx.consultar<{ cnpj: string; nome: string | null }>(sql`
        select parceiro_cnpj as cnpj, max(nullif(btrim(parceiro_nome), '')) as nome
        from erp.ctes
        where empresa_id = ${empresaId} and parceiro_cnpj is not null and parceiro_cnpj <> ''
        group by parceiro_cnpj`);
      return linhas
        .flatMap((l) => (l.nome ? [{ cnpj: l.cnpj, nome: l.nome }] : []))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
  };
}
