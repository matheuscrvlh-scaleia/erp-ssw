import { atribuicoes, sql, type Transacao, valoresDeInsercao } from "@erp/db";
import { chaveDoFeriado } from "@erp/domain/calendar";

import {
  type FeriadoGravado,
  type NovoFeriado,
  type RepositorioCalendario,
} from "./calendar.service";

// Teto de segurança: um ano tem algumas dezenas de feriados por empresa.
const LIMITE_POR_ANO = 2000;

const SELECT_FERIADO = sql`
  select id, empresa_id as "empresaId", data, tipo, cidade, uf, descricao,
         gerado_automaticamente as "geradoAutomaticamente"
  from erp.feriados`;

/**
 * Gerais (empresa nula) + os da empresa; sem empresa, só os gerais. O RLS repete esta regra como
 * segunda barreira.
 */
const visiveisPara = (empresaId: string | null) =>
  sql`(empresa_id is null or empresa_id = ${empresaId})`;

export function criarRepositorioCalendario(tx: Transacao): RepositorioCalendario {
  return {
    feriados: (empresaId, de, ate) =>
      tx.consultar<FeriadoGravado>(sql`
        ${SELECT_FERIADO}
        where ${visiveisPara(empresaId)} and data >= ${de} and data <= ${ate}
        order by data
        limit ${LIMITE_POR_ANO}`),

    proximo: async (empresaId, aPartirDe) => {
      const [linha] = await tx.consultar<FeriadoGravado>(sql`
        ${SELECT_FERIADO}
        where ${visiveisPara(empresaId)} and data >= ${aPartirDe}
        order by data
        limit 1`);
      return linha ?? null;
    },

    unidadesAtivas: (empresaId) =>
      tx.consultar<{ id: string; nome: string; cidade: string; uf: string }>(sql`
        select id, nome, cidade, uf from erp.unidades
        where empresa_id = ${empresaId} and ativo
        order by nome`),

    feriado: async (empresaId, id) => {
      const [linha] = await tx.consultar<FeriadoGravado>(sql`
        ${SELECT_FERIADO} where ${visiveisPara(empresaId)} and id = ${id}`);
      return linha ?? null;
    },

    chavesExistentes: async (empresaId, datas, tipo) => {
      const linhas = await tx.consultar<Pick<NovoFeriado, "data" | "tipo" | "cidade" | "uf">>(sql`
        select data, tipo, cidade, uf from erp.feriados
        where ${visiveisPara(empresaId)} and data = any(${datas}::date[]) and tipo = ${tipo}`);
      return new Set(linhas.map(chaveDoFeriado));
    },

    inserir: async (novos) => {
      if (novos.length === 0) return 0;
      return tx.executar(sql`
        insert into erp.feriados ${valoresDeInsercao(novos)} on conflict do nothing`);
    },

    alterar: async (id, dados) => {
      await tx.executar(sql`
        update erp.feriados set ${atribuicoes(dados)}, atualizado_em = now() where id = ${id}`);
    },

    excluir: async (id) => {
      await tx.executar(sql`delete from erp.feriados where id = ${id}`);
    },
  };
}
