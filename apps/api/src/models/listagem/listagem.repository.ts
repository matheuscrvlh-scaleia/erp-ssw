import { type Transacao } from "@erp/db";
import { codigosOcorrencia, ctes, romaneioCteAtual } from "@erp/db/schema";
import { type FiltroLista } from "@erp/dominio/listagem/filtro";
import { CODIGO_SAIDA_PARA_ENTREGA } from "@erp/dominio/nucleo";
import { z } from "@erp/shared/zod";
import { and, type AnyColumn, eq, sql } from "drizzle-orm";

import { diaNoFuso, tipoDocumentoEfetivo } from "../cte/sql-cte";
import { expressoesDoCtrc, ordemDaLista, whereDaLista } from "./consulta";
import { type Agregados, type RepositorioListagem } from "./listagem.service";

/**
 * As consultas da Listagem varrem o período inteiro: teto próprio, como as funções pesadas de
 * hoje (30 s). Estourou, o tratador central pede para reduzir o período.
 */
const TEMPO_DA_CONSULTA_MS = 30_000;

async function consultaPesada(tx: Transacao): Promise<void> {
  await tx.execute(
    sql`select set_config('statement_timeout', ${String(TEMPO_DA_CONSULTA_MS)}, true)`,
  );
}

const real = (coluna: AnyColumn) => sql<number | null>`${coluna}::float8`;

const contagemPorCodigo = z.object({
  codigo: z.number().int(),
  descricao: z.string().nullable(),
  qtd: z.number().int(),
});

const linhaDosAgregados = z.object({
  total: z.number().int(),
  por_codigo: z.array(contagemPorCodigo),
  por_unidade: z.array(z.object({ unidade: z.string(), qtd: z.number().int() })),
  por_cidade: z.array(z.object({ cidade: z.string(), qtd: z.number().int() })),
  por_atraso: z.array(z.object({ atraso: z.number().int(), qtd: z.number().int() })),
});

/** Base das contagens: só as colunas que os gráficos agrupam. */
function baseDosAgregados(
  empresaId: string,
  f: FiltroLista,
  comAtraso: boolean,
  semCodigos = false,
) {
  const { codigo, atraso } = expressoesDoCtrc(f);
  return sql`select
      ${codigo} as cod,
      nullif(btrim(${ctes.ocorrEfetivaDescricao}), '') as descr,
      ${ctes.filialEfetiva} as sigla,
      nullif(btrim(${ctes.cidadeDestino}), '') as cidade,
      ${comAtraso ? atraso : sql`null::int`} as atraso
    from ${ctes}
    where ${whereDaLista(empresaId, f, { semCodigos })}`;
}

const porCodigo = (top: number) => sql`coalesce((
    select json_agg(x order by x.qtd desc, x.codigo asc) from (
      select cod as codigo, max(descr) as descricao, count(*)::int as qtd
      from base where cod is not null group by cod order by 3 desc, 1 asc limit ${top}
    ) x), '[]'::json)`;

export function criarRepositorioListagem(tx: Transacao): RepositorioListagem {
  return {
    linhas: async (empresaId, f, pagina) => {
      await consultaPesada(tx);
      const { atraso } = expressoesDoCtrc(f);
      const linhas = await tx
        .select({
          id: ctes.id,
          sigla: ctes.sigla,
          numero: ctes.numero,
          numeroNf: ctes.numeroNf,
          destinatario: ctes.destinatario,
          cidadeDestino: ctes.cidadeDestino,
          bairroDestino: ctes.bairroDestino,
          setor: ctes.setor,
          setorDestino: ctes.setorDestino,
          unidadeDestino: ctes.filialEfetiva,
          codigo: ctes.ocorrEfetivaCodigoNum,
          descricao: sql<
            string | null
          >`coalesce(nullif(btrim(${ctes.ocorrEfetivaDescricao}), ''), ${codigosOcorrencia.descricao})`,
          dataOcorrencia: ctes.ocorrEfetivaData,
          // Placa só quando a efetiva é a saída para entrega (texto exato, como hoje).
          placa: sql<
            string | null
          >`case when ${ctes.ocorrEfetivaCodigo} = ${String(CODIGO_SAIDA_PARA_ENTREGA)} then ${romaneioCteAtual.placa} end`,
          dataEmissao: ctes.dataEmissao,
          dataPrevista: ctes.dataPrevistaEntrega,
          // Dia da entrega em Brasília (Q11; hoje sai o dia UTC).
          dataEntrega: sql<string | null>`${diaNoFuso(ctes.dataEntregaRealizada, f.fuso)}::text`,
          dataEmbarque: ctes.dataEmbarque,
          parceiroNome: ctes.parceiroNome,
          pagadorNome: ctes.pagadorNome,
          remetente: ctes.remetente,
          tipoDocumento: sql<string | null>`${tipoDocumentoEfetivo()}`,
          peso: real(ctes.peso),
          valorFrete: real(ctes.valorFrete),
          volumes: ctes.volumes,
          localizacao: sql<
            string | null
          >`coalesce(nullif(btrim(${ctes.localizacaoAtual}), ''), nullif(btrim(${ctes.ocorrEfetivaLocal}), ''))`,
          primeiroManifesto: ctes.primeiroManifesto,
          ultimoManifesto: ctes.ultimoManifesto,
          valorMercadoria: real(ctes.valorMercadoria),
          atrasoDias: sql<number | null>`(${atraso})::int`,
          performanceDias: ctes.performanceDias,
          noPrazo: ctes.noPrazo,
          responsabilidadeCliente: ctes.responsabilidadeCliente,
          tde: real(ctes.tde),
        })
        .from(ctes)
        .leftJoin(
          codigosOcorrencia,
          and(
            eq(codigosOcorrencia.empresaId, ctes.empresaId),
            eq(codigosOcorrencia.codigo, ctes.ocorrEfetivaCodigoNum),
          ),
        )
        .leftJoin(
          romaneioCteAtual,
          and(
            eq(romaneioCteAtual.empresaId, ctes.empresaId),
            eq(romaneioCteAtual.sigla, ctes.sigla),
            eq(romaneioCteAtual.numero, ctes.numero),
          ),
        )
        .where(whereDaLista(empresaId, f))
        .orderBy(...ordemDaLista(f, pagina.ordem, pagina.direcao))
        .limit(Math.max(pagina.limite, 1))
        .offset(Math.max(pagina.deslocamento, 0));
      return linhas.map((l) => ({ ...l, dataOcorrencia: l.dataOcorrencia?.toISOString() ?? null }));
    },

    agregados: async (empresaId, f, opcoes): Promise<Agregados> => {
      await consultaPesada(tx);
      // Uma passada só: a base é lida uma vez e os quatro gráficos saem dela.
      const resultado = await tx.execute(sql`
        with base as materialized (${baseDosAgregados(empresaId, f, opcoes.comAtraso)})
        select
          (select count(*)::int from base) as total,
          ${porCodigo(opcoes.topCodigos)} as por_codigo,
          coalesce((
            select json_agg(x order by x.qtd desc, x.unidade asc) from (
              select sigla as unidade, count(*)::int as qtd
              from base where sigla is not null group by sigla
            ) x), '[]'::json) as por_unidade,
          coalesce((
            select json_agg(x order by x.qtd desc, x.cidade asc) from (
              select cidade, count(*)::int as qtd
              from base where cidade is not null group by cidade order by 2 desc, 1 asc
              limit ${opcoes.topCidades}
            ) x), '[]'::json) as por_cidade,
          coalesce((
            select json_agg(x) from (
              select atraso, count(*)::int as qtd from base where atraso > 0 group by atraso
            ) x), '[]'::json) as por_atraso`);
      const [linha] = z.array(linhaDosAgregados).length(1).parse(resultado.rows);
      return {
        total: linha?.total ?? 0,
        porCodigo: linha?.por_codigo ?? [],
        porUnidade: linha?.por_unidade ?? [],
        porCidade: linha?.por_cidade ?? [],
        porAtraso: linha?.por_atraso ?? [],
      };
    },

    codigosDoRecorte: async (empresaId, f, top) => {
      await consultaPesada(tx);
      const resultado = await tx.execute(sql`
        with base as materialized (${baseDosAgregados(empresaId, f, false, true)})
        select ${porCodigo(top)} as por_codigo`);
      const [linha] = z
        .array(z.object({ por_codigo: z.array(contagemPorCodigo) }))
        .length(1)
        .parse(resultado.rows);
      return linha?.por_codigo ?? [];
    },
  };
}
