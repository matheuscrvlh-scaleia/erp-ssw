import { comInstantes, type Sql, sql, type Transacao } from "@erp/db";
import { classificar, pesaContraAOperacao } from "@erp/dominio/ocorrencias/catalogo";
import { linhaDeOcorrencia, type OrdemDaLista } from "@erp/shared/contratos/ocorrencias";
import { z } from "@erp/shared/zod";

import { type LeitorDeConfiguracoes } from "../configuracoes/leitor";
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
  uuids,
} from "../cte/sql-cte";
import {
  type FiltroDeCtes,
  type PedidoDaLista,
  type RepositorioOcorrencias,
} from "./ocorrencias.service";

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
const DIRECAO = { asc: sql.literal("asc"), desc: sql.literal("desc") } as const;

/**
 * Ordem de cada coluna da lista; nulo sempre por último e desempate pelo id do evento (como
 * `ordenarLista` do domínio). Data até o segundo; número do CT-e como número (Q06).
 */
function ordemDaLista(ordem: OrdemDaLista, direcao: "asc" | "desc"): Sql {
  const d = DIRECAO[direcao];
  const chave: Record<OrdemDaLista, Sql> = {
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
function consultaDaLista(f: FiltroDeCtes, p: PedidoDaLista): Sql {
  const classificados = p.catalogo.map((c) => {
    const k = classificar(c.codigo, null, c);
    return { codigo: c.codigo, ...k, pesa: pesaContraAOperacao(k) };
  });
  const bools = (valores: boolean[]) => sql`${lista(valores.map(String))}::bool[]`;
  const c = COLUNAS_DO_CTE;
  const prev = sql`ctes.data_prevista_entrega`;
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
  const aba: Record<PedidoDaLista["recortes"]["responsabilidade"], Sql | undefined> = {
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

  return sql`with cat(codigo, pendente, penaliza, pesa, responsavel, descricao) as (
    select * from unnest(
      ${inteiros(classificados.map((k) => k.codigo))},
      ${bools(classificados.map((k) => k.pendente))},
      ${bools(classificados.map((k) => k.penaliza))},
      ${bools(classificados.map((k) => k.pesa))},
      ${textos(classificados.map((k) => k.responsavel))},
      ${textos(classificados.map((k) => k.descricao))})
  ), l as (
    select ocorrencias.id as id, ocorrencias.data_hora as data_hora, ocorrencias.codigo as codigo,
      coalesce(cat.descricao, ocorrencias.descricao, 'Código ' || ocorrencias.codigo) as descricao,
      coalesce(cat.responsavel, 'pendente') as responsavel,
      coalesce(cat.penaliza, false) as penaliza,
      coalesce(cat.pendente, true) as pendente,
      bool_or(coalesce(cat.pesa, false)) over (partition by ocorrencias.cte_id) as cte_pesa,
      ctes.id as cte_id, ctes.numero as numero_ctrc, ctes.sigla as sigla_ctrc,
      ctes.numero_nf as numero_nf, ctes.data_emissao::text as data_emissao,
      ctes.filial_efetiva as unidade_resp,
      coalesce(nullif(ctes.pagador_nome, ''), nullif(ctes.pagador_cnpj, ''), '—') as pagador,
      ctes.destinatario as destinatario, ctes.cidade_destino as cidade_destino,
      ctes.uf_destino as uf_destino, ctes.peso as peso, ctes.volumes as volumes,
      ctes.valor_frete as valor_frete, ${prev}::text as data_prevista_entrega,
      ctes.setor as setor, ctes.no_prazo as no_prazo, ${atrasoDias} as atraso_dias,
      coalesce(parceiros.nome, ctes.parceiro_nome) as parceiro_nome,
      conf.conferente as conferente, conf.romaneio as romaneio
    from erp.ocorrencias
    join erp.ctes on ctes.id = ocorrencias.cte_id
    left join erp.parceiros on parceiros.id = ctes.parceiro_id
    left join erp.romaneio_conferente_cte conf on conf.empresa_id = ctes.empresa_id
      and conf.sigla = ctes.sigla and conf.numero = ctes.numero
    left join cat on cat.codigo = ocorrencias.codigo
    where ${ondeCtes(f)}
      and ocorrencias.empresa_id = ${f.empresaId}
      and ocorrencias.codigo = any(${inteiros(p.codigosTela)})
      -- Q21 do dono: ocorrência em quarentena fica fora de todas as contas.
      and not ocorrencias.quarentena
      ${p.tipos.length > 0 ? sql`and ${tipoDocumentoDoFiltro()} = any(${textos(p.tipos)})` : sql.vazio()}
  )
  select l.id, l.data_hora as "dataHora", l.codigo, l.descricao, l.responsavel, l.penaliza,
    l.pendente, l.cte_id as "cteId", l.numero_ctrc as "numeroCtrc", l.sigla_ctrc as "siglaCtrc",
    l.numero_nf as "numeroNf", l.data_emissao as "dataEmissao", l.unidade_resp as "unidadeResp",
    l.pagador, l.destinatario, l.cidade_destino as "cidadeDestino", l.uf_destino as "ufDestino",
    l.peso, l.volumes, l.valor_frete as "valorFrete",
    l.data_prevista_entrega as "dataPrevistaEntrega", l.setor, l.atraso_dias as "atrasoDias",
    l.conferente, l.romaneio, count(*) over () as total
  from l
  ${filtros.length > 0 ? sql`where ${sql.juntar(filtros, sql` and `)}` : sql.vazio()}
  order by ${ordemDaLista(p.ordem, p.direcao)}`;
}

/**
 * Universo (não fora e filial própria) + filtros de CT-e. Nenhuma regra além de comparar as
 * colunas gravadas com o que a tela pediu.
 */
function ondeCtes(f: FiltroDeCtes): Sql {
  const data =
    f.campoData === "prevista" ? sql`ctes.data_prevista_entrega` : sql`ctes.data_emissao`;
  return sql.e(
    sql`ctes.empresa_id = ${f.empresaId}`,
    sql`not ctes.fora_universo`,
    sql`ctes.filial_efetiva in (${filiaisProprias(f.empresaId)})`,
    sql.ou(...f.periodos.map((p) => sql`${data} between ${p.inicio} and ${p.fim}`)),
    f.unidades.length > 0 ? sql`ctes.unidade_id = any(${uuids(f.unidades)})` : undefined,
    f.conferentes.length > 0
      ? sql`exists (
          select 1 from erp.romaneio_conferente_cte rc
          where rc.empresa_id = ctes.empresa_id and rc.sigla = ctes.sigla
            and rc.numero = ctes.numero and rc.conferente = any(${textos(f.conferentes)}))`
      : undefined,
    f.parceiros.length > 0
      ? sql`ctes.pagador_cnpj_digitos = any(${textos(f.parceiros)})`
      : undefined,
    f.filiais.length > 0 ? sql`ctes.filial_efetiva = any(${textos(f.filiais)})` : undefined,
    f.remetente ? casaAlgumPadrao(sql`ctes.remetente`, f.remetente) : undefined,
    f.destino ? casaAlgumPadrao(sql`ctes.cidade_destino`, f.destino) : undefined,
    f.ctrc ? sql`ctes.numero = ${f.ctrc}` : undefined,
    f.nf ? nfIgual(f.nf) : undefined,
  );
}

export function criarRepositorioOcorrencias(
  tx: Transacao,
  configuracoesVigentes: LeitorDeConfiguracoes,
): RepositorioOcorrencias {
  return {
    catalogo: (empresaId) =>
      tx.consultar(sql`
        select codigo, descricao, responsavel, penaliza,
               pendente_classificacao as "pendenteClassificacao",
               pendencia_acompanhada as "pendenciaAcompanhada", tipo_ssw as "tipoSsw"
        from erp.codigos_ocorrencia where empresa_id = ${empresaId}`),

    configuracao: async (empresaId, chave) =>
      (await configuracoesVigentes(empresaId, [chave])).get(chave) ?? null,

    ctes: async (filtro, limite) =>
      comInstantes<Awaited<ReturnType<RepositorioOcorrencias["ctes"]>>[number]>(
        await tx.consultar(sql`
          select ctes.id, ctes.sigla, ctes.numero, ctes.data_emissao as "dataEmissao",
                 ctes.data_prevista_entrega as "dataPrevistaEntrega",
                 ctes.data_entrega_realizada as "dataEntregaRealizada",
                 ctes.ocorr_efetiva_codigo_num as "codigoEfetivo", ctes.no_prazo as "noPrazo",
                 ctes.pagador_nome as "pagadorNome", ctes.pagador_cnpj as "pagadorCnpj",
                 ctes.filial_efetiva as "filialEfetiva",
                 ctes.tipo_documento_455 as "tipoDocumento455",
                 ctes.tipo_documento as "tipoDocumento",
                 coalesce(parceiros.nome, ctes.parceiro_nome) as "parceiroNome"
          from erp.ctes
          left join erp.parceiros on parceiros.id = ctes.parceiro_id
          where ${ondeCtes(filtro)}
          limit ${limite}`),
        ["dataEntregaRealizada"],
      ),

    ocorrencias: async (filtro, codigos, limite) =>
      comInstantes<Awaited<ReturnType<RepositorioOcorrencias["ocorrencias"]>>[number]>(
        await tx.consultar(sql`
          select ocorrencias.id, ocorrencias.cte_id as "cteId", ocorrencias.codigo,
                 ocorrencias.descricao, ocorrencias.data_hora as "dataHora"
          from erp.ocorrencias
          join erp.ctes on ctes.id = ocorrencias.cte_id
          where ${ondeCtes(filtro)}
            and ocorrencias.empresa_id = ${filtro.empresaId}
            and ocorrencias.codigo = any(${inteiros(codigos)})
            -- Q21 do dono: ocorrência em quarentena fica fora de todas as contas.
            and not ocorrencias.quarentena
          limit ${limite}`),
        ["dataHora"],
      ),

    lista: async (filtro, pedido, pagina) => {
      const consulta = consultaDaLista(filtro, pedido);
      const linhas = z
        .array(linhaLida)
        .parse(
          await tx.consultar(sql`${consulta} limit ${pagina.limite} offset ${pagina.deslocamento}`),
        );
      const total =
        linhas[0]?.total ??
        (pagina.deslocamento === 0
          ? 0
          : ((
              await tx.consultar<{ n: number }>(sql`
                select count(*)::int as n from (${consulta}) l`)
            )[0]?.n ?? 0));
      return { total, linhas: linhas.map(({ total: _total, ...l }) => l) };
    },

    conferentes: async (empresaId, limite) => {
      const linhas = await tx.consultar<{ conferente: string }>(sql`
        select distinct conferente from erp.romaneio_conferente_cte
        where empresa_id = ${empresaId} and conferente is not null
        order by conferente
        limit ${limite}`);
      return linhas.map((l) => l.conferente);
    },

    unidadesAtivas: (empresaId) =>
      tx.consultar(sql`
        select id, nome, cidade, uf from erp.unidades
        where empresa_id = ${empresaId} and ativo
        order by nome`),

    // origem: listar_pagadores_ctrcs (sistema atual), sempre pela emissão.
    pagadores: (empresaId, filtro, limite) => {
      const nome = sql`mode() within group (order by coalesce(nullif(ctes.pagador_nome, ''), ctes.parceiro_nome, ctes.remetente))`;
      return tx.consultar(sql`
        select ctes.pagador_cnpj_digitos as cnpj, max(ctes.pagador_cnpj) as "cnpjFormatado",
               ${nome} as nome
        from erp.ctes
        where ctes.empresa_id = ${empresaId}
          and not ctes.fora_universo
          and ctes.filial_efetiva in (${filiaisProprias(empresaId)})
          and ctes.data_emissao between ${filtro.inicio} and ${filtro.fim}
          and ctes.pagador_cnpj_digitos <> ''
          ${filtro.unidades.length > 0 ? sql`and ctes.unidade_id = any(${uuids(filtro.unidades)})` : sql.vazio()}
          ${filtro.filiais.length > 0 ? sql`and ctes.filial_efetiva = any(${textos(filtro.filiais)})` : sql.vazio()}
        group by ctes.pagador_cnpj_digitos
        order by lower(${nome}), ctes.pagador_cnpj_digitos
        limit ${limite}`);
    },
  };
}
