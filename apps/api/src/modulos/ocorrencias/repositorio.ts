import { type Transacao } from "@erp/db";
import {
  codigosOcorrencia,
  ctes,
  ocorrencias,
  parceiros,
  romaneioConferenteCte,
  unidades,
} from "@erp/db/schema";
import { classificar, pesaContraAOperacao } from "@erp/dominio/ocorrencias/catalogo";
import { linhaDeOcorrencia, type OrdemDaLista } from "@erp/shared/contratos/ocorrencias";
import { z } from "@erp/shared/zod";
import {
  and,
  asc,
  between,
  eq,
  exists,
  inArray,
  isNotNull,
  ne,
  not,
  or,
  type SQL,
  sql,
} from "drizzle-orm";

import {
  aberto,
  casaAlgumPadrao,
  COLUNAS_DO_CTE,
  filiaisProprias,
  inteiros,
  lista,
  nfIgual,
  textos,
  tipoDocumentoDoFiltro,
} from "../../compartilhado/sql-cte";
import { type LeitorDeConfiguracoes } from "../configuracoes/leitor";
import { type FiltroDeCtes, type PedidoDaLista, type RepositorioOcorrencias } from "./casos-de-uso";

/** `numeric` chega do driver como texto. */
const numero = z
  .union([z.string(), z.number()])
  .nullable()
  .transform((v) => (v === null ? null : Number(v)));

/** Linha da consulta da lista (tipos do driver) → a linha da tela. */
const linhaLida = linhaDeOcorrencia.extend({
  dataHora: z.union([z.date(), z.string()]).transform((v) => new Date(v).toISOString()),
  peso: numero,
  valorFrete: numero,
  total: z.union([z.string(), z.number()]).transform(Number),
});

/** Direção como SQL (só os dois valores do enum). */
const DIRECAO = { asc: sql.raw("asc"), desc: sql.raw("desc") } as const;

/**
 * Ordem de cada coluna da lista; nulo sempre por último e desempate pelo id do evento (como
 * `ordenarLista` do domínio). Data até o segundo; número do CT-e como número (Q06).
 */
function ordemDaLista(ordem: OrdemDaLista, direcao: "asc" | "desc"): SQL {
  const d = DIRECAO[direcao];
  const chave: Record<OrdemDaLista, SQL> = {
    data_hora: sql`date_trunc('second', l.data_hora) ${d}`,
    codigo: sql`l.codigo ${d}`,
    responsavel: sql`l.responsavel ${d}`,
    numero_ctrc: sql`length(l.numero_ctrc) ${d}, l.numero_ctrc collate "C" ${d}`,
    parceiro_nome: sql`l.parceiro_nome ${d} nulls last`,
    atraso_dias: sql`l.atraso_dias ${d} nulls last`,
  };
  return sql`${chave[ordem]}, l.id asc`;
}

/**
 * Lista detalhada em SQL, com a regra de `montarLista` (dominio/ocorrencias/lista.ts):
 * classificação pelo catálogo da consulta (sem cadastro = pendente, não penaliza), CT-e
 * penalizante (alguma ocorrência da tela pesa contra a operação e ele está em atraso, antes dos
 * filtros de código e responsável), recortes, código, responsável e aba.
 * origem: ocorrencias_lista_v5 (sistema atual)
 */
function consultaDaLista(tx: Transacao, f: FiltroDeCtes, p: PedidoDaLista): SQL {
  const classificados = p.catalogo.map((c) => {
    const k = classificar(c.codigo, null, c);
    return { codigo: c.codigo, ...k, pesa: pesaContraAOperacao(k) };
  });
  const bools = (valores: boolean[]) => sql`${lista(valores.map(String))}::bool[]`;
  const c = COLUNAS_DO_CTE;
  const prev = sql`${ctes.dataPrevistaEntrega}`;
  const atrasoDias = sql`(case when ${aberto(c, p.baixas)} and ${prev} < ${p.hoje}::date
    then ${p.hoje}::date - ${prev} end)`;
  const r = p.recortes;
  const faixa = sql`(case
    when l.atraso_dias between 1 and 3 then 'ate_3'
    when l.atraso_dias between 4 and 8 then 'de_4_8'
    when l.atraso_dias between 9 and 15 then 'de_9_15'
    when l.atraso_dias between 16 and 30 then 'de_16_30'
    when l.atraso_dias > 30 then 'acima_30' end)`;
  const penalizante = sql`(l.cte_pesa and l.atraso_dias is not null)`;
  const aba: Record<PedidoDaLista["recortes"]["responsabilidade"], SQL | undefined> = {
    todas: undefined,
    pendentes: sql`l.pendente`,
    penalizantes: penalizante,
    externas: sql`not ${penalizante}`,
  };
  const filtros = [
    r.pagador !== null ? sql`l.pagador = ${r.pagador}` : undefined,
    r.unidadeResp !== null ? sql`coalesce(l.unidade_resp, '—') = ${r.unidadeResp}` : undefined,
    r.prazo === "no_prazo" ? sql`l.no_prazo is true` : undefined,
    r.prazo === "fora_prazo" ? sql`l.no_prazo is false` : undefined,
    r.prazo === "sem_prazo" ? sql`l.no_prazo is null` : undefined,
    r.faixaAtraso !== null ? sql`${faixa} = ${r.faixaAtraso}` : undefined,
    r.codigos.length > 0 ? sql`l.codigo = any(${inteiros(r.codigos)})` : undefined,
    r.responsaveis.length > 0 ? sql`l.responsavel = any(${textos(r.responsaveis)})` : undefined,
    aba[r.responsabilidade],
  ].filter((x) => x !== undefined);
  const conf = romaneioConferenteCte;

  return sql`with cat(codigo, pendente, penaliza, pesa, responsavel, descricao) as (
    select * from unnest(
      ${inteiros(classificados.map((k) => k.codigo))},
      ${bools(classificados.map((k) => k.pendente))},
      ${bools(classificados.map((k) => k.penaliza))},
      ${bools(classificados.map((k) => k.pesa))},
      ${textos(classificados.map((k) => k.responsavel))},
      ${textos(classificados.map((k) => k.descricao))})
  ), l as (
    select ${ocorrencias.id} as id, ${ocorrencias.dataHora} as data_hora, ${ocorrencias.codigo} as codigo,
      coalesce(cat.descricao, ${ocorrencias.descricao}, 'Código ' || ${ocorrencias.codigo}) as descricao,
      coalesce(cat.responsavel, 'pendente') as responsavel,
      coalesce(cat.penaliza, false) as penaliza,
      coalesce(cat.pendente, true) as pendente,
      bool_or(coalesce(cat.pesa, false)) over (partition by ${ocorrencias.cteId}) as cte_pesa,
      ${ctes.id} as cte_id, ${ctes.numero} as numero_ctrc, ${ctes.sigla} as sigla_ctrc,
      ${ctes.numeroNf} as numero_nf, ${ctes.dataEmissao}::text as data_emissao,
      ${ctes.filialEfetiva} as unidade_resp,
      coalesce(nullif(${ctes.pagadorNome}, ''), nullif(${ctes.pagadorCnpj}, ''), '—') as pagador,
      ${ctes.destinatario} as destinatario, ${ctes.cidadeDestino} as cidade_destino,
      ${ctes.ufDestino} as uf_destino, ${ctes.peso} as peso, ${ctes.volumes} as volumes,
      ${ctes.valorFrete} as valor_frete, ${prev}::text as data_prevista_entrega,
      ${ctes.setor} as setor, ${ctes.noPrazo} as no_prazo, ${atrasoDias} as atraso_dias,
      coalesce(${parceiros.nome}, ${ctes.parceiroNome}) as parceiro_nome,
      ${conf.conferente} as conferente, ${conf.romaneio} as romaneio
    from ${ocorrencias}
    join ${ctes} on ${ctes.id} = ${ocorrencias.cteId}
    left join ${parceiros} on ${parceiros.id} = ${ctes.parceiroId}
    left join ${conf} on ${conf.empresaId} = ${ctes.empresaId}
      and ${conf.sigla} = ${ctes.sigla} and ${conf.numero} = ${ctes.numero}
    left join cat on cat.codigo = ${ocorrencias.codigo}
    where ${ondeCtes(tx, f)}
      and ${ocorrencias.empresaId} = ${f.empresaId}
      and ${ocorrencias.codigo} = any(${inteiros(p.codigosTela)})
      -- Q21 do dono: ocorrência em quarentena fica fora de todas as contas.
      and not ${ocorrencias.quarentena}
      ${p.tipos.length > 0 ? sql`and ${tipoDocumentoDoFiltro()} = any(${textos(p.tipos)})` : sql``}
  )
  select l.id, l.data_hora as "dataHora", l.codigo, l.descricao, l.responsavel, l.penaliza,
    l.pendente, l.cte_id as "cteId", l.numero_ctrc as "numeroCtrc", l.sigla_ctrc as "siglaCtrc",
    l.numero_nf as "numeroNf", l.data_emissao as "dataEmissao", l.unidade_resp as "unidadeResp",
    l.pagador, l.destinatario, l.cidade_destino as "cidadeDestino", l.uf_destino as "ufDestino",
    l.peso, l.volumes, l.valor_frete as "valorFrete",
    l.data_prevista_entrega as "dataPrevistaEntrega", l.setor, l.atraso_dias as "atrasoDias",
    l.conferente, l.romaneio, count(*) over () as total
  from l
  ${filtros.length > 0 ? sql`where ${sql.join(filtros, sql` and `)}` : sql``}
  order by ${ordemDaLista(p.ordem, p.direcao)}`;
}

/**
 * Universo (não fora e filial própria) + filtros de CT-e. Nenhuma regra além de comparar as
 * colunas gravadas com o que a tela pediu.
 */
function ondeCtes(tx: Transacao, f: FiltroDeCtes): SQL | undefined {
  const data = f.campoData === "prevista" ? ctes.dataPrevistaEntrega : ctes.dataEmissao;
  return and(
    eq(ctes.empresaId, f.empresaId),
    not(ctes.foraUniverso),
    inArray(ctes.filialEfetiva, filiaisProprias(tx, f.empresaId)),
    or(...f.periodos.map((p) => between(data, p.inicio, p.fim))),
    f.unidades.length > 0 ? inArray(ctes.unidadeId, f.unidades) : undefined,
    f.conferentes.length > 0
      ? exists(
          tx
            .select({ um: sql`1` })
            .from(romaneioConferenteCte)
            .where(
              and(
                eq(romaneioConferenteCte.empresaId, ctes.empresaId),
                eq(romaneioConferenteCte.sigla, ctes.sigla),
                eq(romaneioConferenteCte.numero, ctes.numero),
                inArray(romaneioConferenteCte.conferente, f.conferentes),
              ),
            ),
        )
      : undefined,
    f.parceiros.length > 0 ? inArray(ctes.pagadorCnpjDigitos, f.parceiros) : undefined,
    f.filiais.length > 0 ? inArray(ctes.filialEfetiva, f.filiais) : undefined,
    f.remetente ? casaAlgumPadrao(ctes.remetente, f.remetente) : undefined,
    f.destino ? casaAlgumPadrao(ctes.cidadeDestino, f.destino) : undefined,
    f.ctrc ? eq(ctes.numero, f.ctrc) : undefined,
    f.nf ? nfIgual(f.nf) : undefined,
  );
}

export function criarRepositorioOcorrencias(
  tx: Transacao,
  configuracoesVigentes: LeitorDeConfiguracoes,
): RepositorioOcorrencias {
  return {
    catalogo: (empresaId) =>
      tx
        .select({
          codigo: codigosOcorrencia.codigo,
          descricao: codigosOcorrencia.descricao,
          responsavel: codigosOcorrencia.responsavel,
          penaliza: codigosOcorrencia.penaliza,
          pendenteClassificacao: codigosOcorrencia.pendenteClassificacao,
          pendenciaAcompanhada: codigosOcorrencia.pendenciaAcompanhada,
          tipoSsw: codigosOcorrencia.tipoSsw,
        })
        .from(codigosOcorrencia)
        .where(eq(codigosOcorrencia.empresaId, empresaId)),

    configuracao: async (empresaId, chave) =>
      (await configuracoesVigentes(empresaId, [chave])).get(chave) ?? null,

    ctes: (filtro, limite) =>
      tx
        .select({
          id: ctes.id,
          sigla: ctes.sigla,
          numero: ctes.numero,
          dataEmissao: ctes.dataEmissao,
          dataPrevistaEntrega: ctes.dataPrevistaEntrega,
          dataEntregaRealizada: ctes.dataEntregaRealizada,
          codigoEfetivo: ctes.ocorrEfetivaCodigoNum,
          noPrazo: ctes.noPrazo,
          pagadorNome: ctes.pagadorNome,
          pagadorCnpj: ctes.pagadorCnpj,
          filialEfetiva: ctes.filialEfetiva,
          tipoDocumento455: ctes.tipoDocumento455,
          tipoDocumento: ctes.tipoDocumento,
          parceiroNome: sql<string | null>`coalesce(${parceiros.nome}, ${ctes.parceiroNome})`,
        })
        .from(ctes)
        .leftJoin(parceiros, eq(parceiros.id, ctes.parceiroId))
        .where(ondeCtes(tx, filtro))
        .limit(limite),

    ocorrencias: (filtro, codigos, limite) =>
      tx
        .select({
          id: ocorrencias.id,
          cteId: ocorrencias.cteId,
          codigo: ocorrencias.codigo,
          descricao: ocorrencias.descricao,
          dataHora: ocorrencias.dataHora,
        })
        .from(ocorrencias)
        .innerJoin(ctes, eq(ctes.id, ocorrencias.cteId))
        .where(
          and(
            ondeCtes(tx, filtro),
            eq(ocorrencias.empresaId, filtro.empresaId),
            inArray(ocorrencias.codigo, codigos),
            // Q21 do dono: ocorrência em quarentena fica fora de todas as contas.
            not(ocorrencias.quarentena),
          ),
        )
        .limit(limite),

    lista: async (filtro, pedido, pagina) => {
      const consulta = consultaDaLista(tx, filtro, pedido);
      const linhas = z
        .array(linhaLida)
        .parse(
          (await tx.execute(sql`${consulta} limit ${pagina.limite} offset ${pagina.deslocamento}`))
            .rows,
        );
      const total =
        linhas[0]?.total ??
        (pagina.deslocamento === 0
          ? 0
          : Number(
              (await tx.execute(sql`select count(*) as n from (${consulta}) l`)).rows[0]?.["n"] ??
                0,
            ));
      return { total, linhas: linhas.map(({ total: _total, ...l }) => l) };
    },

    conferentes: async (empresaId, limite) => {
      const linhas = await tx
        .selectDistinct({ conferente: romaneioConferenteCte.conferente })
        .from(romaneioConferenteCte)
        .where(
          and(
            eq(romaneioConferenteCte.empresaId, empresaId),
            isNotNull(romaneioConferenteCte.conferente),
          ),
        )
        .orderBy(asc(romaneioConferenteCte.conferente))
        .limit(limite);
      return linhas.flatMap((l) => (l.conferente === null ? [] : [l.conferente]));
    },

    unidadesAtivas: (empresaId) =>
      tx
        .select({ id: unidades.id, nome: unidades.nome, cidade: unidades.cidade, uf: unidades.uf })
        .from(unidades)
        .where(and(eq(unidades.empresaId, empresaId), eq(unidades.ativo, true)))
        .orderBy(asc(unidades.nome)),

    // origem: listar_pagadores_ctrcs (sistema atual), sempre pela emissão.
    pagadores: (empresaId, filtro, limite) => {
      const nome = sql<
        string | null
      >`mode() within group (order by coalesce(nullif(${ctes.pagadorNome}, ''), ${ctes.parceiroNome}, ${ctes.remetente}))`;
      return tx
        .select({
          cnpj: sql<string>`${ctes.pagadorCnpjDigitos}`,
          cnpjFormatado: sql<string>`max(${ctes.pagadorCnpj})`,
          nome,
        })
        .from(ctes)
        .where(
          and(
            eq(ctes.empresaId, empresaId),
            not(ctes.foraUniverso),
            inArray(ctes.filialEfetiva, filiaisProprias(tx, empresaId)),
            between(ctes.dataEmissao, filtro.inicio, filtro.fim),
            ne(ctes.pagadorCnpjDigitos, ""),
            filtro.unidades.length > 0 ? inArray(ctes.unidadeId, filtro.unidades) : undefined,
            filtro.filiais.length > 0 ? inArray(ctes.filialEfetiva, filtro.filiais) : undefined,
          ),
        )
        .groupBy(ctes.pagadorCnpjDigitos)
        .orderBy(sql`lower(${nome})`, asc(ctes.pagadorCnpjDigitos))
        .limit(limite);
    },
  };
}
