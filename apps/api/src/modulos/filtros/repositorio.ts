import { type Transacao } from "@erp/db";
import {
  ctes,
  filiaisApelidos,
  romaneioSaidasCte,
  romaneioViagensCte,
  unidades,
} from "@erp/db/schema";
import { SEM_TIPO_DOCUMENTO } from "@erp/shared/contratos/filtros";
import { z } from "@erp/shared/zod";
import { and, asc, eq, inArray, type SQL, sql } from "drizzle-orm";

import { dentroDoUniverso, diaNoFuso, inteiros, textos, tipoDocumentoEfetivo } from "../ctrc/sql";
import {
  type CampoDataPagador,
  type ContextoDeOpcoes,
  type RepositorioFiltros,
} from "./casos-de-uso";

/** Teto das listas de opção (filiais de uma empresa são dezenas). */
const LIMITE_DE_SIGLAS = 1000;
const LIMITE_DE_TIPOS = 500;

const tipoOuSemTipo = sql<string>`coalesce(${tipoDocumentoEfetivo}, ${SEM_TIPO_DOCUMENTO})`;
const qtd = sql<number>`count(*)::int`;

/** Moda do nome do pagador; empate fica com o menor (mode() pega o primeiro na ordem). */
const nomeDoPagador = sql<
  string | null
>`mode() within group (order by coalesce(nullif(btrim(${ctes.pagadorNome}), ''), ${ctes.parceiroNome}, ${ctes.remetente}))`;

const linhaDeTipo = z.object({ tipo: z.string(), qtd: z.number().int() });

/** Condições das opções: período por emissão e os filtros já escolhidos (sem universo). */
function condicoesDeOpcoes(f: Partial<ContextoDeOpcoes>): (SQL | undefined)[] {
  return [
    f.inicio ? sql`${ctes.dataEmissao} >= ${f.inicio}` : undefined,
    f.fim ? sql`${ctes.dataEmissao} <= ${f.fim}` : undefined,
    f.pagadores ? sql`${ctes.pagadorCnpjDigitos} = any(${textos(f.pagadores)})` : undefined,
    f.remetente ? sql`${ctes.remetente} ilike any(${textos(f.remetente)})` : undefined,
    f.destino ? sql`${ctes.cidadeDestino} ilike any(${textos(f.destino)})` : undefined,
    f.siglas ? sql`${ctes.filialEfetiva} = any(${textos(f.siglas)})` : undefined,
    f.codigos ? sql`${ctes.ocorrEfetivaCodigoNum} = any(${inteiros(f.codigos)})` : undefined,
  ];
}

/**
 * Período do seletor de pagadores pela base de data da tela. Emissão (ou período aberto) recorta
 * cada ponta só se informada; "conclusão" é o dia gravado, sem o −1 dia de hoje (Q12).
 * origem: listar_pagadores_ctrcs, _romaneio_filtro_periodo (sistema atual)
 */
function periodoDoPagador(p: {
  campo: CampoDataPagador;
  inicio: string | null;
  fim: string | null;
}): (SQL | undefined)[] {
  if (p.campo === "emissao" || p.inicio === null || p.fim === null) {
    return [
      p.inicio ? sql`${ctes.dataEmissao} >= ${p.inicio}` : undefined,
      p.fim ? sql`${ctes.dataEmissao} <= ${p.fim}` : undefined,
    ];
  }
  if (p.campo === "saida") {
    return [
      sql`exists (select 1 from ${romaneioSaidasCte}
        where ${romaneioSaidasCte.empresaId} = ${ctes.empresaId}
          and ${romaneioSaidasCte.sigla} = ${ctes.sigla}
          and ${romaneioSaidasCte.numero} = ${ctes.numero}
          and ${romaneioSaidasCte.dataSaida} between ${p.inicio} and ${p.fim})`,
    ];
  }
  const coluna = {
    embarque: ctes.dataEmbarque,
    prevista: ctes.dataPrevistaEntrega,
    conclusao: ctes.dataConclusaoEfetiva,
  }[p.campo];
  return [sql`${coluna} between ${p.inicio} and ${p.fim}`];
}

export function criarRepositorioFiltros(tx: Transacao): RepositorioFiltros {
  return {
    siglasNoPeriodo: async (empresaId, f) => {
      const linhas = await tx
        .selectDistinct({ sigla: ctes.filialEfetiva })
        .from(ctes)
        .where(
          and(
            eq(ctes.empresaId, empresaId),
            sql`nullif(btrim(${ctes.filialEfetiva}), '') is not null`,
            ...condicoesDeOpcoes(f),
          ),
        )
        .orderBy(asc(ctes.filialEfetiva))
        .limit(LIMITE_DE_SIGLAS);
      return linhas.flatMap((l) => (l.sigla ? [l.sigla] : []));
    },

    filiaisDosCtes: async (empresaId) => {
      const linhas = await tx
        .selectDistinct({ filial: ctes.filial })
        .from(ctes)
        .where(
          and(eq(ctes.empresaId, empresaId), sql`nullif(btrim(${ctes.filial}), '') is not null`),
        )
        .orderBy(asc(ctes.filial))
        .limit(LIMITE_DE_SIGLAS);
      return linhas.flatMap((l) => (l.filial ? [l.filial.trim()] : []));
    },

    sugestoes: async (empresaId, campo, contem, f, limite) => {
      const coluna = campo === "remetente" ? ctes.remetente : ctes.cidadeDestino;
      const linhas = await tx
        .selectDistinct({ valor: coluna })
        .from(ctes)
        .where(
          and(
            eq(ctes.empresaId, empresaId),
            sql`nullif(btrim(${coluna}), '') is not null`,
            contem ? sql`${coluna} ilike ${contem}` : undefined,
            ...(f ? condicoesDeOpcoes(f) : []),
          ),
        )
        .orderBy(asc(coluna))
        .limit(limite);
      return linhas.flatMap((l) => (l.valor ? [l.valor] : []));
    },

    cidadesDasUnidades: async (empresaId, ids) => {
      const linhas = await tx
        .select({ cidade: unidades.cidade })
        .from(unidades)
        .where(and(eq(unidades.empresaId, empresaId), inArray(unidades.id, [...ids])));
      return linhas.map((l) => l.cidade);
    },

    siglasDasCidades: async (empresaId, cidades) => {
      const linhas = await tx
        .selectDistinct({ sigla: filiaisApelidos.filial })
        .from(filiaisApelidos)
        .where(
          and(
            eq(filiaisApelidos.empresaId, empresaId),
            inArray(filiaisApelidos.cidadeNormalizada, [...cidades]),
          ),
        );
      return linhas.map((l) => l.sigla.trim().toUpperCase());
    },

    pagadores: (empresaId, f) =>
      tx
        .select({
          cnpj: sql<string>`${ctes.pagadorCnpjDigitos}`,
          cnpjGravado: sql<string | null>`max(${ctes.pagadorCnpj})`,
          nome: nomeDoPagador,
          qtd,
        })
        .from(ctes)
        .where(
          and(
            dentroDoUniverso(empresaId),
            sql`${ctes.filialEfetiva} = any(${textos(f.siglas)})`,
            sql`nullif(${ctes.pagadorCnpjDigitos}, '') is not null`,
            ...periodoDoPagador(f.periodo),
          ),
        )
        .groupBy(ctes.pagadorCnpjDigitos)
        .orderBy(sql`lower(${nomeDoPagador}) asc`, asc(ctes.pagadorCnpjDigitos))
        .limit(f.limite),

    tiposDocumento: (empresaId) =>
      tx
        .select({ tipo: tipoOuSemTipo, qtd })
        .from(ctes)
        .where(dentroDoUniverso(empresaId))
        .groupBy(tipoOuSemTipo)
        .orderBy(sql`2 desc`, sql`1 asc`)
        .limit(LIMITE_DE_TIPOS),

    tiposDocumentoNoPeriodo: async (empresaId, inicio, fim, campo) => {
      if (campo === "romaneio_dia" || campo === "saida") {
        // CT-e que saíram em romaneio no período, ligados pela série + número (Q02).
        const projecao = campo === "saida" ? romaneioSaidasCte : romaneioViagensCte;
        const universo = campo === "saida" ? sql`and not ${ctes.foraUniverso}` : sql``;
        const resultado = await tx.execute(sql`
          select coalesce(${tipoDocumentoEfetivo}, ${SEM_TIPO_DOCUMENTO}) as tipo, count(*)::int as qtd
          from (
            select distinct ${projecao.sigla} as sigla, ${projecao.numero} as numero
            from ${projecao}
            where ${projecao.empresaId} = ${empresaId}
              and ${projecao.dataSaida} between ${inicio} and ${fim}
          ) r
          ${campo === "saida" ? sql`join` : sql`left join`} ${ctes}
            on ${ctes.empresaId} = ${empresaId} and ${ctes.sigla} = r.sigla and ${ctes.numero} = r.numero
            ${universo}
          group by 1
          order by 2 desc, 1 asc
          limit ${LIMITE_DE_TIPOS}`);
        return z.array(linhaDeTipo).parse(resultado.rows);
      }
      const dia: SQL = {
        emissao: sql`${ctes.dataEmissao}`,
        embarque: sql`${ctes.dataEmbarque}`,
        prevista: sql`${ctes.dataPrevistaEntrega}`,
        conclusao: sql`${ctes.dataConclusaoEfetiva}`,
        entrega: diaNoFuso(sql`coalesce(${ctes.dataEntregaRealizada}, ${ctes.ocorrEfetivaData})`),
      }[campo];
      return tx
        .select({ tipo: tipoOuSemTipo, qtd })
        .from(ctes)
        .where(and(dentroDoUniverso(empresaId), sql`${dia} between ${inicio} and ${fim}`))
        .groupBy(tipoOuSemTipo)
        .orderBy(sql`2 desc`, sql`1 asc`)
        .limit(LIMITE_DE_TIPOS);
    },
  };
}
