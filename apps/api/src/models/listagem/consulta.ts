/**
 * Tradução do `FiltroLista` (src/dominio) para o WHERE da Listagem detalhada. As cinco
 * consultas (lista, total e gráficos, códigos do recorte, exportação) usam este mesmo WHERE.
 * origem: _lista_ctrcs_detalhado_filtro (sistema atual), escrito por extenso como lá.
 */
import { type Sql, sql } from "@erp/db";
import {
  CODIGO_AGENDAMENTO,
  CODIGOS_EM_ROTA,
  CODIGOS_PROGRAMACAO,
} from "@erp/dominio/listagem/faixas";
import { type FiltroLista } from "@erp/dominio/listagem/filtro";
import { type CtrcProcurado } from "@erp/dominio/listagem/texto";
import { CODIGO_SAIDA_PARA_ENTREGA } from "@erp/dominio/nucleo";
import { type OrdemLista, type TipoRecorte } from "@erp/shared/contratos/listagem";

import {
  aberto,
  atraso,
  casaAlgumPadrao,
  COLUNAS_DO_CTE,
  dentroDoUniverso,
  diaNoFuso,
  entregue,
  finalizado,
  inicioDoDia,
  inteiros,
  textos,
  tipoDocumentoDoFiltro,
  uuids,
} from "../cte/sql-cte";

const MAIOR_INTEIRO = 2_147_483_647;

/** Expressões por CT-e que dependem do filtro (hoje, catálogo). */
export function expressoesDoCtrc(f: FiltroLista) {
  const c = COLUNAS_DO_CTE;
  const baixas = f.codigosDoCatalogo.baixas;
  return {
    codigo: sql`ctes.ocorr_efetiva_codigo_num`,
    entregue: entregue(c),
    finalizado: finalizado(c, baixas),
    aberto: aberto(c, baixas),
    /** Dia e hoje no fuso da empresa (Q11), baixas do cadastro (Q22). */
    atraso: atraso(c, { baixas, hoje: f.hoje, fuso: f.fuso }),
  };
}

const respTransportadora = sql`coalesce(ctes.responsabilidade_cliente, false) = false`;
const respCliente = sql`coalesce(ctes.responsabilidade_cliente, false) = true`;

/** Existe ocorrência do CT-e fora da quarentena (Q21) que atende `condicao`. */
const existeOcorrencia = (condicao: Sql) =>
  sql`exists (select 1 from erp.ocorrencias where ocorrencias.cte_id = ctes.id and not ocorrencias.quarentena and ${condicao})`;

/** Códigos gravados como texto (0013, 0174): "085" = 85; com letra não é código. */
const codigoTextoIgual = (coluna: Sql, valor: number) =>
  sql`ltrim(btrim(coalesce(${coluna}, '')), '0') = ${String(valor)}`;

function predicadosDosRecortes(
  f: FiltroLista,
): Record<Exclude<TipoRecorte, "emitidos">, () => Sql> {
  const { codigo, entregue, finalizado, aberto, atraso } = expressoesDoCtrc(f);
  const k = f.codigosDoCatalogo;
  const prev = sql`ctes.data_prevista_entrega`;
  const diaDoUltimoMovimento = sql`coalesce(${diaNoFuso(sql`ctes.ocorr_efetiva_data`, f.fuso)}, ctes.data_emissao)`;
  const comOcorrenciaDaTela = existeOcorrencia(
    sql`ocorrencias.codigo = any(${inteiros(k.daTela)})`,
  );
  const penalizante = existeOcorrencia(
    sql`ocorrencias.penaliza and ocorrencias.responsavel <> 'cliente' and ocorrencias.codigo = any(${inteiros(k.acompanhados)})`,
  );
  const emAtraso = sql`${aberto} and ${prev} is not null and ${prev} < ${f.hoje}::date`;
  const saida = CODIGO_SAIDA_PARA_ENTREGA;

  /** origem: _romaneio_em_rota — saiu (85) e a saída vale (depois da emissão, criada depois do CT-e). */
  const emRota = sql`(${codigoTextoIgual(sql`ctes.ocorr_efetiva_codigo`, saida)} and (
    not ${existeOcorrencia(sql`ocorrencias.codigo = ${saida}`)}
    or ${existeOcorrencia(
      sql`ocorrencias.codigo = ${saida} and ocorrencias.data_hora >= ${inicioDoDia(sql`ctes.data_emissao`, f.fuso)} and ocorrencias.criado_em >= ctes.criado_em`,
    )}))`;
  /** origem: _ctrc_travado — pendência (fora a 85) depois da última saída para entrega. */
  const ultima = (condicao: Sql) =>
    sql`(select max(ocorrencias.data_hora) from erp.ocorrencias where ocorrencias.cte_id = ctes.id and not ocorrencias.quarentena and ${condicao})`;
  const travado = sql`(not ${emRota} and coalesce(${ultima(
    sql`ocorrencias.codigo = any(${inteiros(k.pendencias)}) and ocorrencias.codigo <> ${saida}`,
  )} >= coalesce(${ultima(sql`ocorrencias.codigo = ${saida}`)}, '-infinity'::timestamptz), false))`;

  /** origem: _bucket_status_previsto */
  const statusPrevisto = sql`(case
    when ${codigo} = ${CODIGO_AGENDAMENTO} then 'agendamento'
    when ${codigo} = any(${inteiros(CODIGOS_EM_ROTA)}) then 'rota'
    when ${codigo} = any(${inteiros(k.pendencias)}) then 'pendencia'
    when ${codigo} is null or ${codigo} = any(${inteiros(CODIGOS_PROGRAMACAO)}) then 'programacao'
    else 'outros' end)`;
  /** origem: _bucket_faixa_prev, com o hoje de Brasília (Q11) */
  const faixaPrevisto = sql`(case
    when ${prev} is null then 'sem_prev'
    when ${prev} < ${f.hoje}::date then 'vencido'
    when ${prev} = ${f.hoje}::date then 'hoje'
    when ${prev} = ${f.hoje}::date + 1 then 'd1'
    when ${prev} = ${f.hoje}::date + 2 then 'd2'
    else 'd3_mais' end)`;

  return {
    entregues: () => entregue,
    no_prazo: () => sql`ctes.no_prazo is true`,
    fora_prazo: () => sql`ctes.no_prazo is false and ${respTransportadora}`,
    atrasados: () => sql`${aberto} and ${atraso} > 0 and ${respTransportadora}`,
    sem_movimento: () =>
      sql`${aberto} and ${respTransportadora} and ${atraso} > ${f.limiteSemMovimento} and ${f.hoje}::date - ${diaDoUltimoMovimento} > ${f.limiteSemMovimento}`,
    penalizados: () => penalizante,
    penalizados_abertos: () => sql`${aberto} and ${penalizante}`,
    em_atraso: () => emAtraso,
    em_atraso_fr: () => sql`${emAtraso} and ${respTransportadora}`,
    em_atraso_cliente: () => sql`${emAtraso} and ${respCliente}`,
    por_codigo: () => (f.codigoRecorte === null ? sql`false` : sql`${codigo} = ${f.codigoRecorte}`),
    por_faixa_atraso: () =>
      sql`${atraso} between ${f.faixaMin ?? 0} and ${f.faixaMax ?? MAIOR_INTEIRO}`,
    finalizado_sistema: () => finalizado,
    previstos_por_status: () =>
      f.statusPrevisto === null
        ? aberto
        : sql`${aberto} and ${statusPrevisto} = ${f.statusPrevisto}`,
    previstos_por_faixa: () =>
      f.faixaPrev === null ? aberto : sql`${aberto} and ${faixaPrevisto} = ${f.faixaPrev}`,
    sla_fr: () => sql`${respTransportadora} and ctes.no_prazo is not null`,
    sla_cliente: () => sql`${respCliente} and ctes.no_prazo is not null`,
    vencimento_proximo: () =>
      sql`${aberto} and ${respTransportadora} and ${prev} between ${f.hoje}::date and ${f.ultimoDiaDeVencimento}::date`,
    nascido_atrasado: () =>
      sql`${prev} is not null and (select min(${diaNoFuso(sql`ocorrencias.data_hora`, f.fuso)}) from erp.ocorrencias where ocorrencias.cte_id = ctes.id and not ocorrencias.quarentena and ocorrencias.codigo = ${saida}) > ${prev}`,
    nascido_em_atraso: () => sql`${prev} < ctes.prazo_padrao_data`,
    otif: () =>
      existeOcorrencia(
        sql`ocorrencias.codigo = any(${inteiros(k.pendencias)}) and ocorrencias.codigo <> ${saida}`,
      ),
    sem_atualizacao: () =>
      sql`${aberto} and ${respTransportadora} and ${f.hoje}::date - ${diaDoUltimoMovimento} >= ${f.diasSemAtualizacao}`,
    ocorrencia_13: () => existeOcorrencia(sql`ocorrencias.codigo = 13`),
    ocorrencia_13_multipla: () =>
      sql`${aberto} and (select count(*) from erp.ocorrencias where ocorrencias.cte_id = ctes.id and not ocorrencias.quarentena and ocorrencias.codigo = 13) >= 2`,
    tde_aguardando: () =>
      sql`coalesce(ctes.tde, 0) > 0 and ${aberto} and (${travado} or not (${codigoTextoIgual(sql`ctes.ocorr_efetiva_codigo`, saida)} or ${codigoTextoIgual(sql`ctes.ultima_ocorr_codigo_0013`, saida)} or ${codigoTextoIgual(sql`ctes.ult_ocorr_codigo_0174`, saida)}))`,
    ocorr_entregues: () => sql`${comOcorrenciaDaTela} and ${entregue}`,
    ocorr_baixados: () => sql`${comOcorrenciaDaTela} and not ${entregue} and ${finalizado}`,
    ocorr_abertos: () => sql`${comOcorrenciaDaTela} and ${aberto}`,
    ocorr_em_atraso: () => sql`${comOcorrenciaDaTela} and ${emAtraso}`,
  };
}

/** Nota igual: a nula vale "0" (como hoje); número grande demais não casa nenhuma. */
function notaIgual(nota: string): Sql {
  if (nota === "") return sql`(ctes.numero_nf is null or ctes.numero_nf = 0)`;
  const valor = Number(nota);
  return valor <= MAIOR_INTEIRO ? sql`ctes.numero_nf = ${valor}` : sql`false`;
}

function ctrcIgual(procurado: CtrcProcurado): Sql {
  const numero = sql`ctes.numero = ${procurado.numero}`;
  return procurado.sigla === null ? numero : sql`(${numero} and ctes.sigla = ${procurado.sigla})`;
}

const COLUNA_DA_BASE = {
  emissao: sql`ctes.data_emissao`,
  prevista: sql`ctes.data_prevista_entrega`,
  concluido: sql`ctes.data_conclusao_efetiva`,
} as const;

interface OpcoesDoWhere {
  /** Os códigos do recorte ignoram o próprio filtro de códigos. */
  semCodigos?: boolean;
}

/**
 * O WHERE da Listagem: universo, filtros da tela e os recortes (OU entre eles).
 * origem: _lista_ctrcs_detalhado_filtro (sistema atual)
 */
export function whereDaLista(empresaId: string, f: FiltroLista, opcoes: OpcoesDoWhere = {}): Sql {
  const { codigo, atraso } = expressoesDoCtrc(f);
  const coluna = f.periodo ? COLUNA_DA_BASE[f.periodo.base] : null;
  const predicados = predicadosDosRecortes(f);
  const recortes = f.recortes.flatMap((r) => (r === "emitidos" ? [] : [predicados[r]()]));
  return sql.e(
    dentroDoUniverso(empresaId),
    sql`ctes.filial_efetiva = any(${textos(f.siglas)})`,
    coluna && f.periodo?.inicio ? sql`${coluna} >= ${f.periodo.inicio}` : undefined,
    coluna && f.periodo?.fim ? sql`${coluna} <= ${f.periodo.fim}` : undefined,
    f.unidadesIds ? sql`ctes.unidade_id = any(${uuids(f.unidadesIds)})` : undefined,
    f.pagadores ? sql`ctes.pagador_cnpj_digitos = any(${textos(f.pagadores)})` : undefined,
    f.remetente ? casaAlgumPadrao(sql`ctes.remetente`, f.remetente) : undefined,
    f.destino ? casaAlgumPadrao(sql`ctes.cidade_destino`, f.destino) : undefined,
    f.cidade ? casaAlgumPadrao(sql`ctes.cidade_destino`, f.cidade) : undefined,
    f.codigos && !opcoes.semCodigos ? sql`${codigo} = any(${inteiros(f.codigos)})` : undefined,
    f.tipos ? sql`${tipoDocumentoDoFiltro()} = any(${textos(f.tipos)})` : undefined,
    f.pesoMin !== null ? sql`ctes.peso >= ${f.pesoMin}` : undefined,
    f.pesoMax !== null ? sql`ctes.peso <= ${f.pesoMax}` : undefined,
    f.atrasoMin !== null ? sql`${atraso} >= ${f.atrasoMin}` : undefined,
    f.atrasoMax !== null ? sql`${atraso} <= ${f.atrasoMax}` : undefined,
    f.ctrc ? ctrcIgual(f.ctrc) : undefined,
    f.nf !== null ? notaIgual(f.nf) : undefined,
    f.busca ? sql`(${ctrcIgual(f.busca)} or ${notaIgual(f.busca.numero)})` : undefined,
    recortes.length > 0
      ? sql`(${sql.juntar(
          recortes.map((r) => sql`(${r})`),
          sql` or `,
        )})`
      : undefined,
  );
}

/**
 * Ordem da lista: a coluna escolhida (vazios no fim), depois emissão mais recente e o número
 * (como número, Q06) — e série + id para a página nunca repetir nem pular CT-e (Q07).
 * origem: listar_ctrcs_detalhado (sistema atual)
 */
export function ordemDaLista(f: FiltroLista, ordem: OrdemLista, direcao: "asc" | "desc"): Sql[] {
  const { atraso } = expressoesDoCtrc(f);
  const desempate = [
    sql`ctes.data_emissao desc`,
    sql`ctes.numero::bigint asc`,
    sql`ctes.sigla asc`,
    sql`ctes.id asc`,
  ];
  if (ordem === "emissao" && direcao === "desc") return desempate;
  const chave = {
    atraso,
    prev: sql`ctes.data_prevista_entrega`,
    entrega: sql`ctes.data_entrega_realizada`,
    emissao: sql`ctes.data_emissao`,
  }[ordem];
  return [
    direcao === "asc" ? sql`${chave} asc nulls last` : sql`${chave} desc nulls last`,
    ...desempate,
  ];
}
