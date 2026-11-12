/**
 * Pedaços de SQL do CT-e usados por várias telas (Listagem, Performance, Ocorrências,
 * Comprovantes, Romaneio, Prazo do parceiro, filtros). Cada regra está escrita aqui uma vez, em
 * TypeScript; o banco só executa. Todo valor de fora entra como parâmetro, inclusive o fuso: o dia
 * é o do fuso da empresa (Brasília na FR, decisão Q11).
 */
import { type Sql, sql } from "@erp/db";
import { CODIGOS_ENTREGA } from "@erp/dominio/nucleo/codigos";
import { SEM_TIPO_DOCUMENTO } from "@erp/shared/contratos/filtros";

type Expressao = Sql;

/** Lista JS como UM parâmetro (array do Postgres); o cast é de quem usa. */
export const lista = (valores: readonly (string | number)[]): Sql => sql`${[...valores]}`;
export const textos = (valores: readonly string[]): Sql => sql`${lista(valores)}::text[]`;
export const inteiros = (valores: readonly number[]): Sql => sql`${lista(valores)}::int[]`;
export const uuids = (valores: readonly string[]): Sql => sql`${lista(valores)}::uuid[]`;

/** Colunas do CT-e que as regras daqui leem, pelo apelido da tabela na consulta. */
export interface ColunasDoCte {
  dataEntregaRealizada: Expressao;
  /** Código da ocorrência efetiva já normalizado (`ocorr_efetiva_codigo_num`). */
  codigoEfetivo: Expressao;
  dataPrevistaEntrega: Expressao;
  performanceDias: Expressao;
  tipoDocumento455: Expressao;
  tipoDocumento: Expressao;
}

/** `apelido.coluna`: consulta com `from erp.ctes <apelido>`. */
export function colunasDoApelido(apelido: string): ColunasDoCte {
  const coluna = (nome: string) => sql`${sql.identificador(apelido)}.${sql.identificador(nome)}`;
  return {
    dataEntregaRealizada: coluna("data_entrega_realizada"),
    codigoEfetivo: coluna("ocorr_efetiva_codigo_num"),
    dataPrevistaEntrega: coluna("data_prevista_entrega"),
    performanceDias: coluna("performance_dias"),
    tipoDocumento455: coluna("tipo_documento_455"),
    tipoDocumento: coluna("tipo_documento"),
  };
}

/** `ctes.coluna`: consulta com `from erp.ctes` sem apelido. */
export const COLUNAS_DO_CTE: ColunasDoCte = colunasDoApelido("ctes");

/** Dia de um instante no fuso dado. origem: (x AT TIME ZONE 'America/Sao_Paulo')::date */
export const diaNoFuso = (instante: Expressao, fuso: string): Sql =>
  sql`(${instante} AT TIME ZONE ${fuso})::date`;

/** Meia-noite de um dia no fuso dado. */
export const inicioDoDia = (dia: Expressao, fuso: string): Sql =>
  sql`(${dia}::timestamp AT TIME ZONE ${fuso})`;

/**
 * Tipo de documento efetivo: o do 455 vence o do BI2; maiúsculas; vazio = sem tipo (nulo).
 * origem: tipo_documento_efetivo (sistema atual)
 */
export const tipoDocumentoEfetivo = (c: ColunasDoCte = COLUNAS_DO_CTE): Sql =>
  sql`nullif(upper(coalesce(nullif(btrim(${c.tipoDocumento455}), ''), btrim(${c.tipoDocumento}))), '')`;

/** Tipo efetivo como os filtros usam: sem tipo = `__SEM_TIPO__`. */
export const tipoDocumentoDoFiltro = (c: ColunasDoCte = COLUNAS_DO_CTE): Sql =>
  sql`coalesce(${tipoDocumentoEfetivo(c)}, ${SEM_TIPO_DOCUMENTO})`;

const codigoDeEntrega = (c: ColunasDoCte): Sql =>
  sql`coalesce(${c.codigoEfetivo} = any(${inteiros([...CODIGOS_ENTREGA])}), false)`;
const codigoDeBaixa = (c: ColunasDoCte, baixas: readonly number[]): Sql =>
  sql`coalesce(${c.codigoEfetivo} = any(${inteiros(baixas)}), false)`;

/** Entregue: data de entrega gravada ou efetiva de entrega (1/18/67). origem: _is_entregue */
export const entregue = (c: ColunasDoCte = COLUNAS_DO_CTE): Sql =>
  sql`(${c.dataEntregaRealizada} is not null or ${codigoDeEntrega(c)})`;

/**
 * Finalizado sem entrega por um código de baixa do cadastro da empresa (Q22).
 * origem: _is_finalizado_sem_entrega
 */
export const finalizado = (c: ColunasDoCte, baixas: readonly number[]): Sql =>
  sql`(${c.dataEntregaRealizada} is null and ${c.codigoEfetivo} is not null and ${c.codigoEfetivo} <> 1 and ${c.codigoEfetivo} = any(${inteiros(baixas)}))`;

/** Nem entregue nem baixado. A 1ª condição deixa o plano usar os índices de CT-e em aberto. */
export const aberto = (c: ColunasDoCte, baixas: readonly number[]): Sql =>
  sql`(${c.dataEntregaRealizada} is null and not ${codigoDeEntrega(c)} and not ${codigoDeBaixa(c, baixas)})`;

/** O que o atraso precisa saber de fora: baixas do cadastro (Q22), hoje e o fuso da empresa. */
export interface RegraDoAtraso {
  baixas: readonly number[];
  /** Hoje (`AAAA-MM-DD`) no fuso da empresa. */
  hoje: string;
  fuso: string;
}

/**
 * Atraso em dias como na lista: previsão nula → nulo; entregue → dia da entrega − previsão;
 * efetiva de entrega → `performance_dias`; baixa → nulo; senão hoje − previsão.
 * origem: atraso_lista_dias (sistema atual; baixa pelo cadastro, decisão Q22)
 */
export const atraso = (c: ColunasDoCte, regra: RegraDoAtraso): Sql =>
  sql`(case
    when ${c.dataPrevistaEntrega} is null then null
    when ${c.dataEntregaRealizada} is not null
      then ${diaNoFuso(c.dataEntregaRealizada, regra.fuso)} - ${c.dataPrevistaEntrega}
    when ${codigoDeEntrega(c)} then ${c.performanceDias}
    when ${codigoDeBaixa(c, regra.baixas)} then null
    else ${regra.hoje}::date - ${c.dataPrevistaEntrega}
  end)`;

/** Filtro de texto com vários valores ("a|b"): casa se qualquer padrão ILIKE casar. */
export const casaAlgumPadrao = (coluna: Expressao, padroes: readonly string[]): Sql =>
  sql`${coluna} ilike any(${textos(padroes)})`;

/** NF digitada → igualdade com o número gravado (inteiro); número grande demais não casa. */
export function nfIgual(termo: string): Sql {
  return termo.length <= 9 ? sql`ctes.numero_nf = ${Number(termo)}` : sql`false`;
}

/** Subconsulta das siglas das filiais próprias da empresa: o universo das telas. */
export const filiaisProprias = (empresaId: string): Sql =>
  sql`select sigla from erp.filiais where empresa_id = ${empresaId} and propria`;

/** CT-e fora de todas as telas (cancelado no dia, cópia) sai sempre. */
export const dentroDoUniverso = (empresaId: string): Sql =>
  sql`ctes.empresa_id = ${empresaId} and not ctes.fora_universo`;
