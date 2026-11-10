import { CODIGOS_ENTREGA } from "@erp/dominio/nucleo/codigos";
import { type FiltroCtrc } from "@erp/dominio/performance/filtro";
import { type BaseDeData, SEM_TIPO_DOCUMENTO } from "@erp/shared/contratos/performance";
import { type SQL, sql } from "drizzle-orm";

/*
 * Pedaços de SQL das consultas da Performance (alias `c` = `erp.ctes`). A regra está escrita aqui,
 * em TypeScript, uma vez só; o banco só executa. Todo valor vai como parâmetro.
 */

/** Quem consulta e o relógio da consulta (o teste controla o "hoje"). */
export interface ContextoDaConsulta {
  empresaId: string;
  /** Fuso da empresa: dia da entrega, da ocorrência e "hoje" (decisão Q11). */
  fuso: string;
  /** Hoje no fuso da empresa (`AAAA-MM-DD`). */
  hoje: string;
  filiaisProprias: readonly string[];
}

/** Lista como um parâmetro só (`= any($1::text[])`), não como `($1, $2…)`. */
export const lista = (valores: readonly (string | number)[]): SQL =>
  sql`${sql.param([...valores])}`;

const COLUNA_DA_BASE: Record<BaseDeData, SQL> = {
  emissao: sql`c.data_emissao`,
  prevista: sql`c.data_prevista_entrega`,
  concluido: sql`c.data_conclusao_efetiva`,
};

export const colunaDaBase = (base: BaseDeData): SQL => COLUNA_DA_BASE[base];

/** Código da ocorrência efetiva; -1 quando não há (deixa as negações sem `NULL`). */
const codigo = sql`coalesce(c.ocorr_efetiva_codigo_num, -1)`;

/** Entregue: data de entrega ou efetiva de entrega (1/18/67). origem: _is_entregue */
export const ENTREGUE = sql`(c.data_entrega_realizada is not null or ${codigo} = any(${lista([...CODIGOS_ENTREGA])}::int[]))`;

/** Baixado sem entrega pelo cadastro da empresa. origem: _is_finalizado_sem_entrega */
export const finalizado = (baixas: readonly number[]): SQL =>
  sql`(c.data_entrega_realizada is null and ${codigo} <> 1 and ${codigo} = any(${lista(baixas)}::int[]))`;

/** Responsabilidade do cliente; nula conta como da transportadora. */
export const DO_CLIENTE = sql`coalesce(c.responsabilidade_cliente, false)`;

/** Tipo de documento do 455, senão o do BI2, em maiúsculas. origem: tipo_documento_efetivo */
export const TIPO_EFETIVO = sql`coalesce(upper(coalesce(nullif(btrim(c.tipo_documento_455), ''), nullif(btrim(c.tipo_documento), ''))), ${SEM_TIPO_DOCUMENTO})`;

/** Dia de um instante no fuso da empresa. */
export const diaNoFuso = (coluna: SQL, fuso: string): SQL =>
  sql`(${coluna} at time zone ${fuso})::date`;

/**
 * Atraso em dias como na lista: previsão nula → nulo; entregue → dia da entrega − previsão;
 * efetiva de entrega → `performance_dias`; baixa → nulo; senão hoje − previsão.
 * origem: atraso_lista_dias (sistema atual; baixa pelo cadastro, decisão Q22)
 */
export const atraso = (ctx: ContextoDaConsulta, baixas: readonly number[]): SQL => sql`(case
  when c.data_prevista_entrega is null then null
  when c.data_entrega_realizada is not null
    then ${diaNoFuso(sql`c.data_entrega_realizada`, ctx.fuso)} - c.data_prevista_entrega
  when ${codigo} = any(${lista([...CODIGOS_ENTREGA])}::int[]) then c.performance_dias
  when ${codigo} = any(${lista(baixas)}::int[]) then null
  else ${ctx.hoje}::date - c.data_prevista_entrega
end)`;

/** Partes do filtro que cada chamada pode deixar de fora. */
export interface Opcoes {
  semPeriodo?: boolean;
  semCodigos?: boolean;
  semTipos?: boolean;
}

/**
 * `WHERE` da Performance: universo da tela (empresa, filial efetiva própria, fora das cópias e
 * cancelados) e só os filtros preenchidos.
 * origem: _perf_filtro_ctrcs (sistema atual)
 */
export function ondeDoFiltro(f: FiltroCtrc, ctx: ContextoDaConsulta, opcoes: Opcoes = {}): SQL {
  const partes: SQL[] = [
    sql`c.empresa_id = ${ctx.empresaId}`,
    sql`not c.fora_universo`,
    sql`c.filial_efetiva = any(${lista(ctx.filiaisProprias)}::text[])`,
  ];
  if (f.periodo && !opcoes.semPeriodo) {
    const coluna = colunaDaBase(f.baseData);
    partes.push(sql`${coluna} between ${f.periodo.inicio}::date and ${f.periodo.fim}::date`);
  }
  if (f.unidades) partes.push(sql`c.unidade_id = any(${lista(f.unidades)}::uuid[])`);
  if (f.parceiros) partes.push(sql`c.pagador_cnpj_digitos = any(${lista(f.parceiros)}::text[])`);
  if (f.filiais) partes.push(sql`c.filial_efetiva = any(${lista(f.filiais)}::text[])`);
  if (f.remetente) partes.push(sql`c.remetente ilike any(${lista(f.remetente)}::text[])`);
  if (f.destino) partes.push(sql`c.cidade_destino ilike any(${lista(f.destino)}::text[])`);
  if (f.codigos && !opcoes.semCodigos) {
    partes.push(sql`c.ocorr_efetiva_codigo_num = any(${lista(f.codigos)}::int[])`);
  }
  if (f.tipos && !opcoes.semTipos)
    partes.push(sql`${TIPO_EFETIVO} = any(${lista(f.tipos)}::text[])`);
  return sql.join(partes, sql` and `);
}

/** O filtro de códigos como expressão (os alertas contam com e sem ele na mesma passada). */
export function casaCodigos(f: FiltroCtrc): SQL {
  return f.codigos ? sql`c.ocorr_efetiva_codigo_num = any(${lista(f.codigos)}::int[])` : sql`true`;
}
