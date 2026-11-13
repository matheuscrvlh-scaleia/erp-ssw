import { type Sql, sql, type Transacao } from "@erp/db";
import { type EfeitoBonificacao } from "@erp/domain/delivery-bonus";

import {
  type PeriodoDaApuracao,
  type RepositorioBonificacaoEntrega,
} from "./delivery-bonus.service";

/** Unidade do romaneio (`v` = `erp.romaneio_viagens_cte`): as 3 primeiras letras, maiúsculas. */
const unidadeDoRomaneio = sql`upper(left(btrim(v.romaneio), 3))`;

/**
 * Viagens do período (romaneio por viagem, já sem romaneio cancelado) das unidades pedidas.
 * origem: staging 036 de bonificacao_apurar, agora pela projeção (Q02: sigla + número)
 */
function doPeriodo(empresaId: string, p: PeriodoDaApuracao): Sql {
  return sql.e(
    sql`v.empresa_id = ${empresaId}`,
    sql`v.data_saida >= ${p.inicio}`,
    sql`v.data_saida <= ${p.fim}`,
    p.unidades ? sql`${unidadeDoRomaneio} = any(${[...p.unidades]}::text[])` : undefined,
  );
}

const SELECT_FALTA = sql`
  select id, colaborador_nome as "colaboradorNome", data_falta as "dataFalta", tipo, observacao
  from erp.bonificacao_faltas`;

interface LinhaDoBalde {
  romaneio: string;
  placa: string | null;
  data: string;
  codigo: number | null;
  ctes: number;
  motorista: string | null;
  ajudante: string | null;
  ajudante2: string | null;
  ajudante3: string | null;
}

/** numeric chega do pg em texto. */
interface LinhaDeParametros {
  id: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  taxaTurbo: string;
  taxaAcelerado: string;
  taxaEmRotaGrande: string;
  taxaEmRotaPequena: string;
  metaRotaPequena: string;
  metaRotaGrande: string;
  metaEmRota: string;
  limiteNfsRotaPequena: number;
}

export function criarRepositorioBonificacaoEntrega(tx: Transacao): RepositorioBonificacaoEntrega {
  return {
    unidades: (empresaId) =>
      tx.consultar(sql`
        select ${unidadeDoRomaneio} as unidade, count(distinct v.romaneio)::int as romaneios,
               max(v.data_saida)::text as "ultimoDia"
        from erp.romaneio_viagens_cte v
        where v.empresa_id = ${empresaId} and length(btrim(v.romaneio)) >= 3
        group by 1
        order by 2 desc`),

    parametros: async (empresaId) => {
      const linhas = await tx.consultar<LinhaDeParametros>(sql`
        select id, vigencia_inicio as "vigenciaInicio", vigencia_fim as "vigenciaFim",
               taxa_turbo as "taxaTurbo", taxa_acelerado as "taxaAcelerado",
               taxa_em_rota_grande as "taxaEmRotaGrande",
               taxa_em_rota_pequena as "taxaEmRotaPequena",
               meta_rota_pequena as "metaRotaPequena", meta_rota_grande as "metaRotaGrande",
               meta_em_rota as "metaEmRota", limite_nfs_rota_pequena as "limiteNfsRotaPequena"
        from erp.bonificacao_parametros
        where empresa_id = ${empresaId}
        order by vigencia_inicio desc`);
      return linhas.map((l) => ({
        id: l.id,
        vigenciaInicio: l.vigenciaInicio,
        vigenciaFim: l.vigenciaFim,
        taxaTurbo: Number(l.taxaTurbo),
        taxaAcelerado: Number(l.taxaAcelerado),
        taxaEmRotaGrande: Number(l.taxaEmRotaGrande),
        taxaEmRotaPequena: Number(l.taxaEmRotaPequena),
        metaRotaPequena: Number(l.metaRotaPequena),
        metaRotaGrande: Number(l.metaRotaGrande),
        metaEmRota: Number(l.metaEmRota),
        limiteNfsRotaPequena: l.limiteNfsRotaPequena,
      }));
    },

    colaboradores: async (empresaId, periodo) => {
      const linhas = await tx.consultar<{ nome: string }>(sql`
        select distinct btrim(pessoa.nome) as nome
          from erp.romaneio_viagens_cte v
         cross join lateral (values (v.motorista), (v.ajudante), (v.ajudante_2), (v.ajudante_3))
           as pessoa(nome)
         where ${doPeriodo(empresaId, periodo)}
           and btrim(coalesce(pessoa.nome, '')) <> ''`);
      return linhas.map((l) => l.nome);
    },

    baldes: async (empresaId, periodo) =>
      // Ocorrência do dia do romaneio (não o desfecho final): a última do dia no fuso da
      // empresa (Q11), fora de quarentena.
      tx.consultar<LinhaDoBalde>(sql`
        select v.romaneio as romaneio, v.placa as placa, v.data_saida::text as data,
               do_dia.codigo, count(*)::int as ctes,
               max(v.motorista) as motorista, max(v.ajudante) as ajudante,
               max(v.ajudante_2) as "ajudante2", max(v.ajudante_3) as "ajudante3"
          from erp.romaneio_viagens_cte v
          left join erp.ctes
            on ctes.empresa_id = v.empresa_id
           and ctes.sigla = v.sigla
           and ctes.numero = v.numero
          left join lateral (
            select ocorrencias.codigo as codigo
              from erp.ocorrencias
             where ocorrencias.cte_id = ctes.id
               and not ocorrencias.quarentena
               and (ocorrencias.data_hora at time zone ${periodo.fuso})::date = v.data_saida
             order by ocorrencias.data_hora desc
             limit 1
          ) as do_dia on true
         where ${doPeriodo(empresaId, periodo)}
         group by 1, 2, 3, 4`),

    efeitos: (empresaId) =>
      tx.consultar<{ codigo: number; efeito: EfeitoBonificacao }>(sql`
        select codigo, efeito from erp.bonificacao_codigos where empresa_id = ${empresaId}`),

    todasAsFaltas: (empresaId) =>
      tx.consultar(sql`
        select colaborador_nome as "colaboradorNome", data_falta as "dataFalta"
        from erp.bonificacao_faltas where empresa_id = ${empresaId}`),

    faltas: (empresaId, inicio, fim) =>
      tx.consultar(sql`
        ${SELECT_FALTA}
        where empresa_id = ${empresaId} and data_falta >= ${inicio} and data_falta <= ${fim}
        order by data_falta desc`),

    falta: async (empresaId, id) => {
      const [linha] = await tx.consultar<
        NonNullable<Awaited<ReturnType<RepositorioBonificacaoEntrega["falta"]>>>
      >(sql`${SELECT_FALTA} where empresa_id = ${empresaId} and id = ${id}`);
      return linha ?? null;
    },

    gravarFalta: async (empresaId, dados, registradoPor) => {
      const [linha] = await tx.consultar<{ id: string }>(sql`
        insert into erp.bonificacao_faltas
          (empresa_id, colaborador_nome, data_falta, tipo, observacao, registrado_por)
        values (${empresaId}, ${dados.colaboradorNome}, ${dados.dataFalta}, ${dados.tipo},
                ${dados.observacao}, ${registradoPor})
        on conflict (empresa_id, colaborador_nome, data_falta) do update
        set tipo = excluded.tipo, observacao = excluded.observacao,
            registrado_por = excluded.registrado_por
        returning id`);
      if (!linha) throw new Error("gravação de falta sem retorno");
      return linha.id;
    },

    excluirFalta: async (id) => {
      await tx.executar(sql`delete from erp.bonificacao_faltas where id = ${id}`);
    },
  };
}
