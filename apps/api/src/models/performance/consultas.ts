import { type Sql, sql } from "@erp/db";
import { type FiltroCtrc } from "@erp/dominio/performance/filtro";
import { type BaseDeData } from "@erp/shared/contratos/performance";

import {
  atraso as atrasoDoCte,
  casaAlgumPadrao,
  colunasDoApelido,
  entregue,
  finalizado as finalizadoDoCte,
  lista,
  tipoDocumentoDoFiltro,
} from "../cte/sql-cte";

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

/** Colunas do CT-e pelo apelido `c` das consultas da Performance. */
const C = colunasDoApelido("c");

const COLUNA_DA_BASE: Record<BaseDeData, Sql> = {
  emissao: sql`c.data_emissao`,
  prevista: sql`c.data_prevista_entrega`,
  concluido: sql`c.data_conclusao_efetiva`,
};

export const colunaDaBase = (base: BaseDeData): Sql => COLUNA_DA_BASE[base];

/** Entregue: data de entrega ou efetiva de entrega (1/18/67). origem: _is_entregue */
export const ENTREGUE = entregue(C);

/** Baixado sem entrega pelo cadastro da empresa. origem: _is_finalizado_sem_entrega */
export const finalizado = (baixas: readonly number[]): Sql => finalizadoDoCte(C, baixas);

/** Responsabilidade do cliente; nula conta como da transportadora. */
export const DO_CLIENTE = sql`coalesce(c.responsabilidade_cliente, false)`;

/** Tipo de documento do 455, senão o do BI2, em maiúsculas. origem: tipo_documento_efetivo */
export const TIPO_EFETIVO = tipoDocumentoDoFiltro(C);

/** Atraso em dias como na lista, no hoje e no fuso da empresa (Q11). origem: atraso_lista_dias */
export const atraso = (ctx: ContextoDaConsulta, baixas: readonly number[]): Sql =>
  atrasoDoCte(C, { baixas, hoje: ctx.hoje, fuso: ctx.fuso });

/** Partes do filtro que cada chamada pode deixar de fora. */
interface Opcoes {
  semPeriodo?: boolean;
  semCodigos?: boolean;
  semTipos?: boolean;
}

/**
 * `WHERE` da Performance: universo da tela (empresa, filial efetiva própria, fora das cópias e
 * cancelados) e só os filtros preenchidos.
 * origem: _perf_filtro_ctrcs (sistema atual)
 */
export function ondeDoFiltro(f: FiltroCtrc, ctx: ContextoDaConsulta, opcoes: Opcoes = {}): Sql {
  const partes: Sql[] = [
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
  if (f.remetente) partes.push(casaAlgumPadrao(sql`c.remetente`, f.remetente));
  if (f.destino) partes.push(casaAlgumPadrao(sql`c.cidade_destino`, f.destino));
  if (f.codigos && !opcoes.semCodigos) {
    partes.push(sql`c.ocorr_efetiva_codigo_num = any(${lista(f.codigos)}::int[])`);
  }
  if (f.tipos && !opcoes.semTipos)
    partes.push(sql`${TIPO_EFETIVO} = any(${lista(f.tipos)}::text[])`);
  return sql.juntar(partes, sql` and `);
}

/** O filtro de códigos como expressão (os alertas contam com e sem ele na mesma passada). */
export function casaCodigos(f: FiltroCtrc): Sql {
  return f.codigos ? sql`c.ocorr_efetiva_codigo_num = any(${lista(f.codigos)}::int[])` : sql`true`;
}
