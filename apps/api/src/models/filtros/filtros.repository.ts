import { type Sql, sql, type Transacao } from "@erp/db";
import { z } from "@erp/shared/zod";

import {
  casaAlgumPadrao,
  dentroDoUniverso,
  diaNoFuso,
  inteiros,
  textos,
  tipoDocumentoDoFiltro,
} from "../cte/sql-cte";
import {
  type CampoDataPagador,
  type ContextoDeOpcoes,
  type RepositorioFiltros,
} from "./filtros.service";

/** Teto das listas de opção (filiais de uma empresa são dezenas). */
const LIMITE_DE_SIGLAS = 1000;
const LIMITE_DE_TIPOS = 500;

const tipoOuSemTipo = sql`${tipoDocumentoDoFiltro()}`;
const qtd = sql`count(*)::int`;

/** Moda do nome do pagador; empate fica com o menor (mode() pega o primeiro na ordem). */
const nomeDoPagador = sql`mode() within group (order by coalesce(nullif(btrim(ctes.pagador_nome), ''), ctes.parceiro_nome, ctes.remetente))`;

const linhaDeTipo = z.object({ tipo: z.string(), qtd: z.number().int() });

/** Condições das opções: período por emissão e os filtros já escolhidos (sem universo). */
function condicoesDeOpcoes(f: Partial<ContextoDeOpcoes>): (Sql | undefined)[] {
  return [
    f.inicio ? sql`ctes.data_emissao >= ${f.inicio}` : undefined,
    f.fim ? sql`ctes.data_emissao <= ${f.fim}` : undefined,
    f.pagadores ? sql`ctes.pagador_cnpj_digitos = any(${textos(f.pagadores)})` : undefined,
    f.remetente ? casaAlgumPadrao(sql`ctes.remetente`, f.remetente) : undefined,
    f.destino ? casaAlgumPadrao(sql`ctes.cidade_destino`, f.destino) : undefined,
    f.siglas ? sql`ctes.filial_efetiva = any(${textos(f.siglas)})` : undefined,
    f.codigos ? sql`ctes.ocorr_efetiva_codigo_num = any(${inteiros(f.codigos)})` : undefined,
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
}): (Sql | undefined)[] {
  if (p.campo === "emissao" || p.inicio === null || p.fim === null) {
    return [
      p.inicio ? sql`ctes.data_emissao >= ${p.inicio}` : undefined,
      p.fim ? sql`ctes.data_emissao <= ${p.fim}` : undefined,
    ];
  }
  if (p.campo === "saida") {
    return [
      sql`exists (select 1 from erp.romaneio_saidas_cte
        where romaneio_saidas_cte.empresa_id = ctes.empresa_id
          and romaneio_saidas_cte.sigla = ctes.sigla
          and romaneio_saidas_cte.numero = ctes.numero
          and romaneio_saidas_cte.data_saida between ${p.inicio} and ${p.fim})`,
    ];
  }
  const coluna = {
    embarque: sql`ctes.data_embarque`,
    prevista: sql`ctes.data_prevista_entrega`,
    conclusao: sql`ctes.data_conclusao_efetiva`,
  }[p.campo];
  return [sql`${coluna} between ${p.inicio} and ${p.fim}`];
}

export function criarRepositorioFiltros(tx: Transacao): RepositorioFiltros {
  /** Tipo efetivo e quantidade dos CT-e do universo que casam `onde`. */
  const tiposComQuantidade = (onde: Sql) =>
    tx.consultar<{ tipo: string; qtd: number }>(sql`
      select ${tipoOuSemTipo} as tipo, ${qtd} as qtd
      from erp.ctes
      where ${onde}
      group by 1
      order by 2 desc, 1 asc
      limit ${LIMITE_DE_TIPOS}`);

  return {
    siglasNoPeriodo: async (empresaId, f) => {
      const linhas = await tx.consultar<{ sigla: string }>(sql`
        select distinct ctes.filial_efetiva as sigla
        from erp.ctes
        where ${sql.e(
          sql`ctes.empresa_id = ${empresaId}`,
          sql`nullif(btrim(ctes.filial_efetiva), '') is not null`,
          ...condicoesDeOpcoes(f),
        )}
        order by 1
        limit ${LIMITE_DE_SIGLAS}`);
      return linhas.map((l) => l.sigla);
    },

    filiaisDosCtes: async (empresaId) => {
      const linhas = await tx.consultar<{ filial: string }>(sql`
        select distinct ctes.filial
        from erp.ctes
        where ctes.empresa_id = ${empresaId} and nullif(btrim(ctes.filial), '') is not null
        order by 1
        limit ${LIMITE_DE_SIGLAS}`);
      return linhas.map((l) => l.filial.trim());
    },

    sugestoes: async (empresaId, campo, contem, f, limite) => {
      const coluna = campo === "remetente" ? sql`ctes.remetente` : sql`ctes.cidade_destino`;
      const linhas = await tx.consultar<{ valor: string }>(sql`
        select distinct ${coluna} as valor
        from erp.ctes
        where ${sql.e(
          sql`ctes.empresa_id = ${empresaId}`,
          sql`nullif(btrim(${coluna}), '') is not null`,
          contem ? sql`${coluna} ilike ${contem}` : undefined,
          ...(f ? condicoesDeOpcoes(f) : []),
        )}
        order by 1
        limit ${limite}`);
      return linhas.map((l) => l.valor);
    },

    cidadesDasUnidades: async (empresaId, ids) => {
      const linhas = await tx.consultar<{ cidade: string }>(sql`
        select cidade from erp.unidades
        where empresa_id = ${empresaId} and id = any(${[...ids]}::uuid[])`);
      return linhas.map((l) => l.cidade);
    },

    siglasDasCidades: async (empresaId, cidades) => {
      const linhas = await tx.consultar<{ sigla: string }>(sql`
        select distinct filial as sigla from erp.filiais_apelidos
        where empresa_id = ${empresaId} and cidade_normalizada = any(${textos([...cidades])})`);
      return linhas.map((l) => l.sigla.trim().toUpperCase());
    },

    pagadores: (empresaId, f) =>
      tx.consultar(sql`
        select ctes.pagador_cnpj_digitos as cnpj, max(ctes.pagador_cnpj) as "cnpjGravado",
               ${nomeDoPagador} as nome, ${qtd} as qtd
        from erp.ctes
        where ${sql.e(
          dentroDoUniverso(empresaId),
          sql`ctes.filial_efetiva = any(${textos(f.siglas)})`,
          sql`nullif(ctes.pagador_cnpj_digitos, '') is not null`,
          ...periodoDoPagador(f.periodo),
        )}
        group by ctes.pagador_cnpj_digitos
        order by lower(${nomeDoPagador}) asc, ctes.pagador_cnpj_digitos asc
        limit ${f.limite}`),

    tiposDocumento: (empresaId) => tiposComQuantidade(dentroDoUniverso(empresaId)),

    tiposDocumentoNoPeriodo: async (empresaId, inicio, fim, campo, fuso) => {
      if (campo === "romaneio_dia" || campo === "saida") {
        // CT-e que saíram em romaneio no período, ligados pela série + número (Q02).
        const projecao =
          campo === "saida" ? sql`erp.romaneio_saidas_cte` : sql`erp.romaneio_viagens_cte`;
        const universo = campo === "saida" ? sql`and not ctes.fora_universo` : sql.vazio();
        const resultado = await tx.consultar(sql`
          select ${tipoOuSemTipo} as tipo, count(*)::int as qtd
          from (
            select distinct p.sigla, p.numero
            from ${projecao} p
            where p.empresa_id = ${empresaId}
              and p.data_saida between ${inicio} and ${fim}
          ) r
          ${campo === "saida" ? sql`join` : sql`left join`} erp.ctes
            on ctes.empresa_id = ${empresaId} and ctes.sigla = r.sigla and ctes.numero = r.numero
            ${universo}
          group by 1
          order by 2 desc, 1 asc
          limit ${LIMITE_DE_TIPOS}`);
        return z.array(linhaDeTipo).parse(resultado);
      }
      const dia: Sql = {
        emissao: sql`ctes.data_emissao`,
        embarque: sql`ctes.data_embarque`,
        prevista: sql`ctes.data_prevista_entrega`,
        conclusao: sql`ctes.data_conclusao_efetiva`,
        entrega: diaNoFuso(
          sql`coalesce(ctes.data_entrega_realizada, ctes.ocorr_efetiva_data)`,
          fuso,
        ),
      }[campo];
      return tiposComQuantidade(
        sql`${dentroDoUniverso(empresaId)} and ${dia} between ${inicio} and ${fim}`,
      );
    },
  };
}
