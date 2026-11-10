import { type Transacao } from "@erp/db";
import { type CodigoDoCatalogo } from "@erp/dominio/performance/catalogo";
import { type SQL, sql } from "drizzle-orm";

import { type RepositorioPerformance } from "./casos-de-uso";
import {
  atraso,
  casaCodigos,
  colunaDaBase,
  diaNoFuso,
  DO_CLIENTE,
  ENTREGUE,
  finalizado,
  lista,
  ondeDoFiltro,
  TIPO_EFETIVO,
} from "./consultas";

type Linha = Record<string, unknown>;

const inteiro = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
/** Texto e numeric chegam do driver como string; inteiros, como número. */
const texto = (v: unknown): string | null =>
  typeof v === "string" ? v : typeof v === "number" ? String(v) : null;
const textoOuZero = (v: unknown): string => texto(v) ?? "0";
/** timestamptz chega como Date (com milissegundos); em ISO para o contrato. */
const instante = (v: unknown): string =>
  v instanceof Date ? v.toISOString() : new Date(texto(v) ?? 0).toISOString();

/** Teto das consultas pesadas, como o `SET statement_timeout = '30s'` das funções de hoje. */
const TEMPO_LIMITE_MS = 30_000;

/** Até onde a lista de ocorrências da exportação vai (proteção, não regra). */
const LIMITE_DE_OCORRENCIAS = 200_000;

export function criarRepositorioPerformance(tx: Transacao): RepositorioPerformance {
  const linhas = async (consulta: SQL): Promise<Linha[]> => (await tx.execute(consulta)).rows;

  return {
    configuracoes: async (empresaId, chaves) => {
      const rs = await linhas(sql`
        select chave, valor, empresa_id is not null as da_empresa
        from erp.configuracoes
        where chave = any(${lista(chaves)}::text[])
          and (empresa_id = ${empresaId} or empresa_id is null)
        order by da_empresa`);
      // Plataforma primeiro, empresa depois: o valor da empresa sobrescreve o padrão.
      return new Map(rs.map((r) => [String(r["chave"]), String(r["valor"])]));
    },

    filiaisProprias: async (empresaId) => {
      const rs = await linhas(sql`
        select sigla from erp.filiais where empresa_id = ${empresaId} and propria order by sigla`);
      return rs.map((r) => String(r["sigla"]));
    },

    catalogo: async (empresaId) => {
      const rs = await linhas(sql`
        select codigo, descricao, tipo_ssw, penaliza, responsavel, pendente_classificacao,
               pendencia_acompanhada
        from erp.codigos_ocorrencia where empresa_id = ${empresaId}`);
      return rs.map((r): CodigoDoCatalogo => ({
        codigo: inteiro(r["codigo"]),
        descricao: String(r["descricao"]),
        tipoSsw: (r["tipo_ssw"] ?? null) as CodigoDoCatalogo["tipoSsw"],
        penaliza: r["penaliza"] === true,
        responsavel: r["responsavel"] as CodigoDoCatalogo["responsavel"],
        pendenteClassificacao: r["pendente_classificacao"] === true,
        pendenciaAcompanhada: r["pendencia_acompanhada"] === true,
      }));
    },

    ampliarTempoLimite: async () => {
      await tx.execute(
        sql`select set_config('statement_timeout', ${String(TEMPO_LIMITE_MS)}, true)`,
      );
    },

    // origem: calcular_performance + relatorio_bloco_agregados (sistema atual)
    contagensPorGrupo: async (ctx, filtro, conjuntos, prejuizo) => {
      const fin = finalizado(conjuntos.baixas);
      const penalizante = sql`o.penaliza and o.responsavel <> 'cliente' and o.codigo = any(${lista(conjuntos.penalizantes)}::int[])`;
      const rs = await linhas(sql`
        with base as (
          select c.filial_efetiva as sigla, c.unidade_id, c.valor_frete,
                 c.data_prevista_entrega as prevista,
                 ${ENTREGUE} as ent, ${fin} as fin, ${DO_CLIENTE} as do_cliente, oc.*
          from erp.ctes c
          cross join lateral (
            select coalesce(bool_or(${penalizante}), false) as tem_penalizante,
                   count(*) filter (where ${penalizante}) as qtd_penalizantes,
                   coalesce(bool_or(o.codigo = 13), false) as tem_13,
                   count(*) filter (
                     where o.codigo = any(${lista(conjuntos.pendentesClassificacao)}::int[])
                   ) as qtd_pendentes,
                   coalesce(bool_or(o.codigo = 85), false) as saiu,
                   coalesce(bool_or(o.codigo = any(${lista(prejuizo)}::int[])), false) as perdido
            from erp.ocorrencias o where o.cte_id = c.id
          ) oc
          where ${ondeDoFiltro(filtro, ctx)}
        )
        select sigla, unidade_id::text as unidade_id,
          count(*)::int as total,
          count(*) filter (where ent)::int as entregues,
          count(*) filter (where fin)::int as finalizados,
          count(*) filter (where ent or fin)::int as concluidos,
          count(*) filter (where not ent and not fin)::int as abertos,
          count(*) filter (where tem_penalizante)::int as penalizados,
          count(*) filter (where tem_penalizante and (ent or fin))::int as penalizados_concluidos,
          count(*) filter (where tem_penalizante and not ent and not fin)::int as penalizados_abertos,
          count(*) filter (where tem_13)::int as retornos,
          count(*) filter (where tem_13 and (ent or fin))::int as retornos_concluidos,
          coalesce(sum(qtd_penalizantes), 0)::int as ocorrencias_penalizantes,
          coalesce(sum(qtd_pendentes), 0)::int as ocorrencias_pendentes,
          count(*) filter (where not ent and not fin and prevista < ${ctx.hoje}::date)::int as em_atraso,
          count(*) filter (
            where not ent and not fin and prevista < ${ctx.hoje}::date and do_cliente
          )::int as em_atraso_cliente,
          count(*) filter (where not ent and not fin and prevista is null)::int as sem_prazo,
          coalesce(sum(valor_frete) filter (where saiu), 0)::text as frete_romaneado,
          coalesce(sum(valor_frete) filter (where saiu and perdido), 0)::text as frete_perdido
        from base
        group by sigla, unidade_id`);
      return rs.map((r) => ({
        sigla: String(r["sigla"]),
        unidadeId: texto(r["unidade_id"]),
        total: inteiro(r["total"]),
        entregues: inteiro(r["entregues"]),
        finalizados: inteiro(r["finalizados"]),
        concluidos: inteiro(r["concluidos"]),
        abertos: inteiro(r["abertos"]),
        penalizados: inteiro(r["penalizados"]),
        penalizadosConcluidos: inteiro(r["penalizados_concluidos"]),
        penalizadosAbertos: inteiro(r["penalizados_abertos"]),
        retornos: inteiro(r["retornos"]),
        retornosConcluidos: inteiro(r["retornos_concluidos"]),
        ocorrenciasPenalizantes: inteiro(r["ocorrencias_penalizantes"]),
        ocorrenciasPendentes: inteiro(r["ocorrencias_pendentes"]),
        emAtraso: inteiro(r["em_atraso"]),
        emAtrasoCliente: inteiro(r["em_atraso_cliente"]),
        semPrazo: inteiro(r["sem_prazo"]),
        freteRomaneado: textoOuZero(r["frete_romaneado"]),
        fretePerdido: textoOuZero(r["frete_perdido"]),
      }));
    },

    metasDeRetorno: async (empresaId, inicio, fim) => {
      const rs = await linhas(sql`
        select unidade_id::text as unidade_id, valor::text as valor
        from erp.metas
        where empresa_id = ${empresaId} and tipo_meta = 'taxa_retorno'
          and vigencia_inicio <= ${fim}::date
          and (vigencia_fim is null or vigencia_fim >= ${inicio}::date)`);
      return rs.map((r) => ({ unidadeId: texto(r["unidade_id"]), valor: Number(r["valor"]) }));
    },

    unidadesAtivas: async (empresaId) => {
      const rs = await linhas(sql`
        select id::text as id, nome from erp.unidades
        where empresa_id = ${empresaId} and ativo order by nome`);
      return rs.map((r) => ({ id: String(r["id"]), nome: String(r["nome"]) }));
    },

    // Inclui cópias e cancelados, como hoje (só informa até onde vão os dados).
    cobertura: async (empresaId) => {
      const [r] = await linhas(sql`
        select min(data_emissao)::text as min, max(data_emissao)::text as max
        from erp.ctes where empresa_id = ${empresaId}`);
      return { min: texto(r?.["min"]), max: texto(r?.["max"]) };
    },

    // origem: calcular_performance_pontualidade (sistema atual)
    pontualidade: async (ctx, filtro) => {
      const rs = await linhas(sql`
        select c.filial_efetiva as sigla,
          count(*)::int as total,
          count(*) filter (where not ${DO_CLIENTE} and c.no_prazo)::int as no_prazo,
          count(*) filter (where not ${DO_CLIENTE} and c.no_prazo = false)::int as fora_prazo,
          count(*) filter (where not ${DO_CLIENTE} and c.no_prazo is null)::int as sem_info,
          count(*) filter (where ${DO_CLIENTE})::int as excluido_cliente,
          count(*) filter (where ${DO_CLIENTE} and c.no_prazo)::int as no_prazo_cliente,
          count(*) filter (where ${DO_CLIENTE} and c.no_prazo = false)::int as fora_prazo_cliente,
          count(*) filter (
            where c.prazo_padrao_data is not null and c.data_prevista_entrega is not null
          )::int as nascidos_avaliados,
          count(*) filter (where c.data_prevista_entrega < c.prazo_padrao_data)::int as nascidos_atraso
        from erp.ctes c
        where ${ondeDoFiltro(filtro, ctx)}
        group by c.filial_efetiva`);
      return rs.map((r) => ({
        sigla: String(r["sigla"]),
        total: inteiro(r["total"]),
        noPrazo: inteiro(r["no_prazo"]),
        foraPrazo: inteiro(r["fora_prazo"]),
        semInfoBi2: inteiro(r["sem_info"]),
        excluidoCliente: inteiro(r["excluido_cliente"]),
        noPrazoCliente: inteiro(r["no_prazo_cliente"]),
        foraPrazoCliente: inteiro(r["fora_prazo_cliente"]),
        nascidosAvaliados: inteiro(r["nascidos_avaliados"]),
        nascidosAtraso: inteiro(r["nascidos_atraso"]),
      }));
    },

    // origem: performance_tde_aguardando + _ctrc_travado + _romaneio_em_rota (sistema atual)
    tdeAguardando: async (ctx, filtro, conjuntos) => {
      const inicioDaEmissao = sql`(c.data_emissao::timestamp at time zone ${ctx.fuso})`;
      const saiu85 = sql`(c.ocorr_efetiva_codigo_num = 85
        or ltrim(coalesce(c.ultima_ocorr_codigo_0013, ''), '0') = '85'
        or ltrim(coalesce(c.ult_ocorr_codigo_0174, ''), '0') = '85')`;
      // Em rota: efetiva 85 e (sem nenhuma 85 registrada, ou alguma 85 coerente com a emissão).
      const emRota = sql`(c.ocorr_efetiva_codigo_num = 85 and coalesce(oc.rota_valida, true))`;
      // Travado: pendência registrada depois (ou junto) da última saída para entrega.
      const travado = sql`(not ${emRota} and oc.ultima_pendencia is not null
        and oc.ultima_pendencia >= coalesce(oc.ultima_85, '-infinity'::timestamptz))`;
      const [r] = await linhas(sql`
        with base as (
          select c.tde,
                 (coalesce(c.tde, 0) > 0 and not ${ENTREGUE} and not ${finalizado(conjuntos.baixas)}
                  and (${travado} or not ${saiu85})) as aguardando
          from erp.ctes c
          cross join lateral (
            select max(o.data_hora) filter (
                     where o.codigo = any(${lista(conjuntos.pendencias)}::int[]) and o.codigo <> 85
                   ) as ultima_pendencia,
                   max(o.data_hora) filter (where o.codigo = 85) as ultima_85,
                   bool_or(not o.quarentena and o.data_hora >= ${inicioDaEmissao}
                           and o.criado_em >= c.criado_em) filter (where o.codigo = 85) as rota_valida
            from erp.ocorrencias o where o.cte_id = c.id
          ) oc
          where ${ondeDoFiltro(filtro, ctx)}
        )
        select count(*) filter (where aguardando)::int as aguardando,
               coalesce(sum(tde) filter (where aguardando), 0)::text as valor,
               count(*) filter (where coalesce(tde, 0) > 0)::int as total
        from base`);
      return {
        aguardando: inteiro(r?.["aguardando"]),
        valor: textoOuZero(r?.["valor"]),
        total: inteiro(r?.["total"]),
      };
    },

    // origem: performance_otif (sistema atual)
    otif: async (ctx, filtro, problema) => {
      const [r] = await linhas(sql`
        select count(*)::int as total,
               count(*) filter (where exists (
                 select 1 from erp.ocorrencias o
                 where o.cte_id = c.id and o.codigo = any(${lista(problema)}::int[])
               ))::int as problemas
        from erp.ctes c
        where ${ondeDoFiltro(filtro, ctx)}`);
      return { total: inteiro(r?.["total"]), problemas: inteiro(r?.["problemas"]) };
    },

    // origem: performance_previstos_breakdown (sistema atual)
    previstos: async (ctx, filtro, conjuntos) => {
      const rs = await linhas(sql`
        select c.ocorr_efetiva_codigo_num as codigo, c.data_prevista_entrega::text as prevista,
               count(*)::int as qtd, coalesce(sum(c.peso), 0)::text as peso,
               coalesce(sum(c.volumes), 0)::int as volumes,
               coalesce(sum(c.valor_frete), 0)::text as frete
        from erp.ctes c
        where ${ondeDoFiltro(filtro, ctx)}
          and not ${ENTREGUE} and not ${finalizado(conjuntos.baixas)}
        group by 1, 2`);
      return rs.map((r) => ({
        codigo: r["codigo"] === null ? null : inteiro(r["codigo"]),
        prevista: texto(r["prevista"]),
        qtd: inteiro(r["qtd"]),
        peso: textoOuZero(r["peso"]),
        volumes: inteiro(r["volumes"]),
        frete: textoOuZero(r["frete"]),
      }));
    },

    // origem: performance_alertas + performance_alerta_ocorrencia_13(_multipla) (sistema atual)
    alertasPorEmissao: async (ctx, filtro, janelas, limites, conjuntos) => {
      const entre = (j: { inicio: string; fim: string }) =>
        sql`c.data_emissao between ${j.inicio}::date and ${j.fim}::date`;
      const n = limites.diasSemMovimento;
      const rs = await linhas(sql`
        with base as (
          select c.filial_efetiva as sigla,
                 ${entre(janelas.periodo)} as no_periodo,
                 ${entre(janelas.baseline)} as na_base,
                 ${entre(janelas.tendenciaAtual)} as na_atual,
                 ${entre(janelas.tendenciaAnterior)} as na_anterior,
                 ${casaCodigos(filtro)} as casa,
                 ${ENTREGUE} as ent, ${finalizado(conjuntos.baixas)} as fin, ${DO_CLIENTE} as do_cliente,
                 c.no_prazo, c.data_prevista_entrega as prevista,
                 c.data_entrega_realizada is null as sem_entrega,
                 coalesce(c.ocorr_efetiva_codigo_num, -1) as cod,
                 coalesce(${diaNoFuso(sql`c.ocorr_efetiva_data`, ctx.fuso)}, c.data_emissao) as dia_ref,
                 oc.qtd_13, oc.primeira_85
          from erp.ctes c
          cross join lateral (
            select count(*) filter (where o.codigo = 13) as qtd_13,
                   min(${diaNoFuso(sql`o.data_hora`, ctx.fuso)}) filter (where o.codigo = 85) as primeira_85
            from erp.ocorrencias o where o.cte_id = c.id
          ) oc
          where ${ondeDoFiltro(filtro, ctx, { semPeriodo: true, semCodigos: true })}
            and ${entre(janelas.leitura)}
        )
        select sigla,
          count(*) filter (
            where no_periodo and casa and not ent and not fin and not do_cliente
              and ${ctx.hoje}::date - prevista > ${n} and ${ctx.hoje}::date - dia_ref > ${n}
          )::int as sem_movimento,
          count(*) filter (
            where no_periodo and casa and prevista is not null and primeira_85 > prevista
              and not (cod = any(${lista([1, 12, 36, 59, 61, 77, 92, 93, 94, 99])}::int[])
                       or (not sem_entrega and cod not in (18, 67)))
          )::int as nascido_atrasado,
          count(*) filter (where no_periodo and qtd_13 > 0)::int as ocorrencia_13,
          count(*) filter (
            where no_periodo and sem_entrega and qtd_13 >= 2
              and (cod = -1 or (cod not in (1, 18, 67)
                                and not cod = any(${lista(conjuntos.baixas)}::int[])))
          )::int as ocorrencia_13_multipla,
          count(*) filter (where no_periodo)::int as fin_total_atual,
          count(*) filter (where no_periodo and fin)::int as fin_atual,
          count(*) filter (where na_base)::int as fin_total_baseline,
          count(*) filter (where na_base and fin)::int as fin_baseline,
          count(*) filter (where na_atual and casa and not do_cliente and no_prazo is not null)::int
            as sla_base_atual,
          count(*) filter (where na_atual and casa and not do_cliente and no_prazo)::int as sla_ok_atual,
          count(*) filter (where na_anterior and casa and not do_cliente and no_prazo is not null)::int
            as sla_base_anterior,
          count(*) filter (where na_anterior and casa and not do_cliente and no_prazo)::int
            as sla_ok_anterior
        from base
        group by sigla`);
      return rs.map((r) => ({
        sigla: String(r["sigla"]),
        semMovimento: inteiro(r["sem_movimento"]),
        nascidoAtrasado: inteiro(r["nascido_atrasado"]),
        ocorrencia13: inteiro(r["ocorrencia_13"]),
        ocorrencia13Multipla: inteiro(r["ocorrencia_13_multipla"]),
        finTotalAtual: inteiro(r["fin_total_atual"]),
        finAtual: inteiro(r["fin_atual"]),
        finTotalBaseline: inteiro(r["fin_total_baseline"]),
        finBaseline: inteiro(r["fin_baseline"]),
        slaBaseAtual: inteiro(r["sla_base_atual"]),
        slaOkAtual: inteiro(r["sla_ok_atual"]),
        slaBaseAnterior: inteiro(r["sla_base_anterior"]),
        slaOkAnterior: inteiro(r["sla_ok_anterior"]),
      }));
    },

    // Em aberto de qualquer emissão (vencendo e sem atualização não seguem o período).
    alertasEmAberto: async (ctx, filtro, limites, conjuntos, limiteDeVencimento) => {
      const diaRef = sql`coalesce(${diaNoFuso(sql`c.ocorr_efetiva_data`, ctx.fuso)}, c.data_emissao)`;
      const rs = await linhas(sql`
        select c.filial_efetiva as sigla, coalesce(c.pagador_cnpj_digitos, '') as parceiro_id,
               coalesce(c.pagador_nome, c.parceiro_nome) as parceiro_nome,
               count(*) filter (
                 where c.data_prevista_entrega between ${ctx.hoje}::date and ${limiteDeVencimento}::date
               )::int as vencendo,
               count(*) filter (
                 where ${ctx.hoje}::date - ${diaRef} >= ${limites.diasSemAtualizacao}
               )::int as sem_atualizacao
        from erp.ctes c
        where ${ondeDoFiltro(filtro, ctx, { semPeriodo: true })}
          and c.data_entrega_realizada is null
          and not ${ENTREGUE} and not ${finalizado(conjuntos.baixas)} and not ${DO_CLIENTE}
        group by 1, 2, 3`);
      return rs.map((r) => ({
        sigla: String(r["sigla"]),
        parceiroId: String(r["parceiro_id"]),
        parceiroNome: texto(r["parceiro_nome"]),
        vencendo: inteiro(r["vencendo"]),
        semAtualizacao: inteiro(r["sem_atualizacao"]),
      }));
    },

    codigosDisponiveis: async (ctx, filtro) => {
      const rs = await linhas(sql`
        select c.ocorr_efetiva_codigo_num as codigo, count(*)::int as qtd
        from erp.ctes c
        where ${ondeDoFiltro(filtro, ctx)} and c.ocorr_efetiva_codigo_num is not null
        group by 1`);
      return rs.map((r) => ({ codigo: inteiro(r["codigo"]), qtd: inteiro(r["qtd"]) }));
    },

    tiposDocumento: async (ctx, filtro) => {
      const rs = await linhas(sql`
        select ${TIPO_EFETIVO} as tipo, count(*)::int as qtd
        from erp.ctes c where ${ondeDoFiltro(filtro, ctx)}
        group by 1 order by 2 desc, 1`);
      return rs.map((r) => ({ tipo: String(r["tipo"]), qtd: inteiro(r["qtd"]) }));
    },

    // origem: sla_serie (sistema atual)
    serie: async (ctx, filtro, granularidade) => {
      const coluna = colunaDaBase(filtro.baseData);
      const periodo =
        granularidade === "mes" ? sql`date_trunc('month', ${coluna})::date` : sql`${coluna}`;
      const rs = await linhas(sql`
        select ${periodo}::text as periodo,
          count(*)::int as total,
          count(*) filter (where ${ENTREGUE})::int as entregue,
          count(*) filter (where ${ENTREGUE} and c.no_prazo = false and not ${DO_CLIENTE})::int
            as fora_transp,
          count(*) filter (where not ${DO_CLIENTE} and c.no_prazo)::int as no_prazo_op,
          count(*) filter (where not ${DO_CLIENTE} and c.no_prazo = false)::int as fora_prazo_op,
          count(*) filter (where ${DO_CLIENTE} and c.no_prazo)::int as no_prazo_cli,
          count(*) filter (where ${DO_CLIENTE} and c.no_prazo = false)::int as fora_prazo_cli
        from erp.ctes c where ${ondeDoFiltro(filtro, ctx)}
        group by 1`);
      return rs.map((r) => ({
        periodo: String(r["periodo"]),
        totalCtrcs: inteiro(r["total"]),
        entregue: inteiro(r["entregue"]),
        foraTransp: inteiro(r["fora_transp"]),
        noPrazoOp: inteiro(r["no_prazo_op"]),
        foraPrazoOp: inteiro(r["fora_prazo_op"]),
        noPrazoCli: inteiro(r["no_prazo_cli"]),
        foraPrazoCli: inteiro(r["fora_prazo_cli"]),
      }));
    },

    // origem: performance_impacto_codigos (sistema atual)
    impacto: async (ctx, filtro, conjuntos) => {
      const rs = await linhas(sql`
        select nullif(c.ultima_ocorr_codigo_0013, '') as codigo, count(*)::int as total,
               count(*) filter (
                 where coalesce(c.no_prazo, false) = false
                   and (c.no_prazo is false or coalesce(${atraso(ctx, conjuntos.baixas)}, 0) > 0)
               )::int as penalizantes
        from erp.ctes c
        where ${ondeDoFiltro(filtro, ctx)} and not ${DO_CLIENTE}
        group by 1`);
      return rs.map((r) => ({
        codigo: texto(r["codigo"]),
        totalCtrcs: inteiro(r["total"]),
        totalPenalizantes: inteiro(r["penalizantes"]),
      }));
    },

    // origem: relatorio_producao_por_unidade (sistema atual)
    producaoPorUnidade: async (ctx, filtro) => {
      const rs = await linhas(sql`
        select c.filial_efetiva as sigla, count(*)::int as emitidos,
               count(*) filter (where ${ENTREGUE})::int as entregues
        from erp.ctes c where ${ondeDoFiltro(filtro, ctx)}
        group by 1`);
      return rs.map((r) => ({
        sigla: String(r["sigla"]),
        emitidos: inteiro(r["emitidos"]),
        entregues: inteiro(r["entregues"]),
      }));
    },

    // origem: performance_finalizado_sistema_breakdown (sistema atual)
    finalizadosPorCodigo: async (ctx, filtro, conjuntos) => {
      const rs = await linhas(sql`
        select c.ocorr_efetiva_codigo_num as codigo, count(*)::int as qtd
        from erp.ctes c
        where ${ondeDoFiltro(filtro, ctx)} and ${finalizado(conjuntos.baixas)}
        group by 1`);
      return rs.map((r) => ({ codigo: inteiro(r["codigo"]), qtd: inteiro(r["qtd"]) }));
    },

    ctesParaExportar: async (ctx, filtro, limite) => {
      const rs = await linhas(sql`
        select c.id::text as id, c.numero_nf, c.numero, c.sigla, c.data_emissao::text as data_emissao,
               c.filial, c.remetente, c.destinatario, c.cidade_destino, c.uf_destino,
               c.peso::text as peso, c.volumes, c.valor_frete::text as valor_frete,
               c.placa_coleta, c.placa_entrega, c.sigla_cte, c.numero_cte, c.status_atual
        from erp.ctes c where ${ondeDoFiltro(filtro, ctx)}
        order by c.data_emissao desc, c.numero
        limit ${limite}`);
      return rs.map((r) => ({
        id: String(r["id"]),
        numeroNf: r["numero_nf"] === null ? null : inteiro(r["numero_nf"]),
        numero: String(r["numero"]),
        sigla: String(r["sigla"]),
        dataEmissao: String(r["data_emissao"]),
        filial: texto(r["filial"]),
        remetente: texto(r["remetente"]),
        destinatario: texto(r["destinatario"]),
        cidadeDestino: texto(r["cidade_destino"]),
        ufDestino: texto(r["uf_destino"]),
        peso: texto(r["peso"]),
        volumes: r["volumes"] === null ? null : inteiro(r["volumes"]),
        valorFrete: texto(r["valor_frete"]),
        placaColeta: texto(r["placa_coleta"]),
        placaEntrega: texto(r["placa_entrega"]),
        siglaCte: texto(r["sigla_cte"]),
        numeroCte: r["numero_cte"] === null ? null : inteiro(r["numero_cte"]),
        statusAtual: texto(r["status_atual"]),
      }));
    },

    ocorrenciasDosCtes: async (ids) => {
      if (ids.length === 0) return [];
      const rs = await linhas(sql`
        select o.cte_id::text as cte_id, o.codigo, coalesce(k.descricao, o.descricao) as descricao,
               o.data_hora
        from erp.ocorrencias o
        left join erp.codigos_ocorrencia k on k.empresa_id = o.empresa_id and k.codigo = o.codigo
        where o.cte_id = any(${lista(ids)}::uuid[])
        order by o.data_hora
        limit ${LIMITE_DE_OCORRENCIAS}`);
      return rs.map((r) => ({
        cteId: String(r["cte_id"]),
        codigo: inteiro(r["codigo"]),
        descricao: texto(r["descricao"]),
        dataHora: instante(r["data_hora"]),
      }));
    },
  };
}
