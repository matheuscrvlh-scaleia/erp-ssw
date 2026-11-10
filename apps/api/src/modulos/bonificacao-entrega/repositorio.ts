import { type Transacao } from "@erp/db";
import {
  bonificacaoCodigos,
  bonificacaoFaltas,
  bonificacaoParametros,
  ctes,
  ocorrencias,
  romaneioViagensCte as viagens,
} from "@erp/db/schema";
import { type EfeitoBonificacao } from "@erp/dominio/bonificacao-entrega";
import { and, desc, eq, gte, lte, type SQL, sql } from "drizzle-orm";

import { type PeriodoDaApuracao, type RepositorioBonificacaoEntrega } from "./casos-de-uso";

/** Unidade do romaneio: as 3 primeiras letras, em maiúsculas. */
const unidadeDoRomaneio = sql<string>`upper(left(btrim(${viagens.romaneio}), 3))`;

/**
 * Viagens do período (romaneio por viagem, já sem romaneio cancelado) das unidades pedidas.
 * origem: staging 036 de bonificacao_apurar, agora pela projeção (Q02: sigla + número)
 */
function doPeriodo(empresaId: string, p: PeriodoDaApuracao): SQL | undefined {
  return and(
    eq(viagens.empresaId, empresaId),
    gte(viagens.dataSaida, p.inicio),
    lte(viagens.dataSaida, p.fim),
    p.unidades
      ? sql`${unidadeDoRomaneio} in (${sql.join(
          p.unidades.map((u) => sql`${u}`),
          sql`, `,
        )})`
      : undefined,
  );
}

const colunasDaFalta = {
  id: bonificacaoFaltas.id,
  colaboradorNome: bonificacaoFaltas.colaboradorNome,
  dataFalta: bonificacaoFaltas.dataFalta,
  tipo: bonificacaoFaltas.tipo,
  observacao: bonificacaoFaltas.observacao,
};

interface LinhaDoBalde extends Record<string, unknown> {
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

export function criarRepositorioBonificacaoEntrega(tx: Transacao): RepositorioBonificacaoEntrega {
  return {
    unidades: (empresaId) =>
      tx
        .select({
          unidade: unidadeDoRomaneio,
          romaneios: sql<number>`count(distinct ${viagens.romaneio})::int`,
          ultimoDia: sql<string>`max(${viagens.dataSaida})::text`,
        })
        .from(viagens)
        .where(and(eq(viagens.empresaId, empresaId), sql`length(btrim(${viagens.romaneio})) >= 3`))
        .groupBy(sql`1`)
        .orderBy(sql`2 desc`),

    parametros: async (empresaId) => {
      const linhas = await tx
        .select()
        .from(bonificacaoParametros)
        .where(eq(bonificacaoParametros.empresaId, empresaId))
        .orderBy(desc(bonificacaoParametros.vigenciaInicio));
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
      const resultado = await tx.execute<{ nome: string }>(sql`
        select distinct btrim(pessoa.nome) as nome
          from ${viagens}
         cross join lateral (values (${viagens.motorista}), (${viagens.ajudante}),
                                    (${viagens.ajudante2}), (${viagens.ajudante3})) as pessoa(nome)
         where ${doPeriodo(empresaId, periodo)}
           and btrim(coalesce(pessoa.nome, '')) <> ''`);
      return resultado.rows.map((l) => l.nome);
    },

    baldes: async (empresaId, periodo) => {
      // Ocorrência do dia do romaneio (não o desfecho final): a última do dia no fuso da
      // empresa (Q11), fora de quarentena.
      const resultado = await tx.execute<LinhaDoBalde>(sql`
        select ${viagens.romaneio} as romaneio, ${viagens.placa} as placa,
               ${viagens.dataSaida}::text as data, do_dia.codigo,
               count(*)::int as ctes,
               max(${viagens.motorista}) as motorista, max(${viagens.ajudante}) as ajudante,
               max(${viagens.ajudante2}) as "ajudante2", max(${viagens.ajudante3}) as "ajudante3"
          from ${viagens}
          left join ${ctes}
            on ${ctes.empresaId} = ${viagens.empresaId}
           and ${ctes.sigla} = ${viagens.sigla}
           and ${ctes.numero} = ${viagens.numero}
          left join lateral (
            select ${ocorrencias.codigo} as codigo
              from ${ocorrencias}
             where ${ocorrencias.cteId} = ${ctes.id}
               and not ${ocorrencias.quarentena}
               and (${ocorrencias.dataHora} at time zone ${periodo.fuso})::date = ${viagens.dataSaida}
             order by ${ocorrencias.dataHora} desc
             limit 1
          ) as do_dia on true
         where ${doPeriodo(empresaId, periodo)}
         group by 1, 2, 3, 4`);
      return resultado.rows.map((l) => ({
        romaneio: l.romaneio,
        placa: l.placa,
        data: l.data,
        codigo: l.codigo,
        ctes: l.ctes,
        motorista: l.motorista,
        ajudante: l.ajudante,
        ajudante2: l.ajudante2,
        ajudante3: l.ajudante3,
      }));
    },

    efeitos: async (empresaId) =>
      (
        await tx
          .select({ codigo: bonificacaoCodigos.codigo, efeito: bonificacaoCodigos.efeito })
          .from(bonificacaoCodigos)
          .where(eq(bonificacaoCodigos.empresaId, empresaId))
      ).map((l) => ({ codigo: l.codigo, efeito: l.efeito satisfies EfeitoBonificacao })),

    todasAsFaltas: (empresaId) =>
      tx
        .select({
          colaboradorNome: bonificacaoFaltas.colaboradorNome,
          dataFalta: bonificacaoFaltas.dataFalta,
        })
        .from(bonificacaoFaltas)
        .where(eq(bonificacaoFaltas.empresaId, empresaId)),

    faltas: (empresaId, inicio, fim) =>
      tx
        .select(colunasDaFalta)
        .from(bonificacaoFaltas)
        .where(
          and(
            eq(bonificacaoFaltas.empresaId, empresaId),
            gte(bonificacaoFaltas.dataFalta, inicio),
            lte(bonificacaoFaltas.dataFalta, fim),
          ),
        )
        .orderBy(desc(bonificacaoFaltas.dataFalta)),

    falta: async (empresaId, id) => {
      const [linha] = await tx
        .select(colunasDaFalta)
        .from(bonificacaoFaltas)
        .where(and(eq(bonificacaoFaltas.empresaId, empresaId), eq(bonificacaoFaltas.id, id)));
      return linha ?? null;
    },

    gravarFalta: async (empresaId, dados, registradoPor) => {
      const [linha] = await tx
        .insert(bonificacaoFaltas)
        .values({ empresaId, ...dados, registradoPor })
        .onConflictDoUpdate({
          target: [
            bonificacaoFaltas.empresaId,
            bonificacaoFaltas.colaboradorNome,
            bonificacaoFaltas.dataFalta,
          ],
          set: { tipo: dados.tipo, observacao: dados.observacao, registradoPor },
        })
        .returning({ id: bonificacaoFaltas.id });
      if (!linha) throw new Error("gravação de falta sem retorno");
      return linha.id;
    },

    excluirFalta: async (id) => {
      await tx.delete(bonificacaoFaltas).where(eq(bonificacaoFaltas.id, id));
    },
  };
}
