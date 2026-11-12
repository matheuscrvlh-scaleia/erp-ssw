import { type Sql, sql, type Transacao } from "@erp/db";
import { type FiltroLista } from "@erp/dominio/listagem/filtro";
import { CODIGO_SAIDA_PARA_ENTREGA } from "@erp/dominio/nucleo";
import { z } from "@erp/shared/zod";

import { diaNoFuso, tipoDocumentoEfetivo } from "../cte/sql-cte";
import { expressoesDoCtrc, ordemDaLista, whereDaLista } from "./consulta";
import { type Agregados, type RepositorioListagem } from "./listagem.service";

/**
 * As consultas da Listagem varrem o período inteiro: teto próprio, como as funções pesadas de
 * hoje (30 s). Estourou, o tratador central pede para reduzir o período.
 */
const TEMPO_DA_CONSULTA_MS = 30_000;

async function consultaPesada(tx: Transacao): Promise<void> {
  await tx.executar(
    sql`select set_config('statement_timeout', ${String(TEMPO_DA_CONSULTA_MS)}, true)`,
  );
}

const real = (coluna: Sql) => sql`${coluna}::float8`;

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
      nullif(btrim(ctes.ocorr_efetiva_descricao), '') as descr,
      ctes.filial_efetiva as sigla,
      nullif(btrim(ctes.cidade_destino), '') as cidade,
      ${comAtraso ? atraso : sql`null::int`} as atraso
    from erp.ctes
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
      const linhas = await tx.consultar<
        Omit<Awaited<ReturnType<RepositorioListagem["linhas"]>>[number], "dataOcorrencia"> & {
          dataOcorrencia: string | null;
        }
      >(sql`
        select ctes.id, ctes.sigla, ctes.numero, ctes.numero_nf as "numeroNf", ctes.destinatario,
          ctes.cidade_destino as "cidadeDestino", ctes.bairro_destino as "bairroDestino",
          ctes.setor, ctes.setor_destino as "setorDestino",
          ctes.filial_efetiva as "unidadeDestino", ctes.ocorr_efetiva_codigo_num as codigo,
          coalesce(nullif(btrim(ctes.ocorr_efetiva_descricao), ''), co.descricao) as descricao,
          ctes.ocorr_efetiva_data as "dataOcorrencia",
          -- Placa só quando a efetiva é a saída para entrega (texto exato, como hoje).
          case when ctes.ocorr_efetiva_codigo = ${String(CODIGO_SAIDA_PARA_ENTREGA)}
            then r.placa end as placa,
          ctes.data_emissao as "dataEmissao", ctes.data_prevista_entrega as "dataPrevista",
          -- Dia da entrega em Brasília (Q11; hoje sai o dia UTC).
          ${diaNoFuso(sql`ctes.data_entrega_realizada`, f.fuso)}::text as "dataEntrega",
          ctes.data_embarque as "dataEmbarque", ctes.parceiro_nome as "parceiroNome",
          ctes.pagador_nome as "pagadorNome", ctes.remetente,
          ${tipoDocumentoEfetivo()} as "tipoDocumento", ${real(sql`ctes.peso`)} as peso,
          ${real(sql`ctes.valor_frete`)} as "valorFrete", ctes.volumes,
          coalesce(nullif(btrim(ctes.localizacao_atual), ''),
                   nullif(btrim(ctes.ocorr_efetiva_local), '')) as localizacao,
          ctes.primeiro_manifesto as "primeiroManifesto",
          ctes.ultimo_manifesto as "ultimoManifesto",
          ${real(sql`ctes.valor_mercadoria`)} as "valorMercadoria",
          (${atraso})::int as "atrasoDias", ctes.performance_dias as "performanceDias",
          ctes.no_prazo as "noPrazo", ctes.responsabilidade_cliente as "responsabilidadeCliente",
          ${real(sql`ctes.tde`)} as tde
        from erp.ctes
        left join erp.codigos_ocorrencia co
          on co.empresa_id = ctes.empresa_id and co.codigo = ctes.ocorr_efetiva_codigo_num
        left join erp.romaneio_cte_atual r
          on r.empresa_id = ctes.empresa_id and r.sigla = ctes.sigla and r.numero = ctes.numero
        where ${whereDaLista(empresaId, f)}
        order by ${sql.juntar(ordemDaLista(f, pagina.ordem, pagina.direcao))}
        limit ${Math.max(pagina.limite, 1)}
        offset ${Math.max(pagina.deslocamento, 0)}`);
      return linhas.map((l) => ({
        ...l,
        dataOcorrencia: l.dataOcorrencia === null ? null : new Date(l.dataOcorrencia).toISOString(),
      }));
    },

    agregados: async (empresaId, f, opcoes): Promise<Agregados> => {
      await consultaPesada(tx);
      // Uma passada só: a base é lida uma vez e os quatro gráficos saem dela.
      const resultado = await tx.consultar(sql`
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
      const [linha] = z.array(linhaDosAgregados).length(1).parse(resultado);
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
      const resultado = await tx.consultar(sql`
        with base as materialized (${baseDosAgregados(empresaId, f, false, true)})
        select ${porCodigo(top)} as por_codigo`);
      const [linha] = z
        .array(z.object({ por_codigo: z.array(contagemPorCodigo) }))
        .length(1)
        .parse(resultado);
      return linha?.por_codigo ?? [];
    },
  };
}
