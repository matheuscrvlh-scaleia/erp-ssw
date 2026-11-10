/**
 * Regras do núcleo do CT-e que a Listagem e o detalhe usam em memória, enquanto o núcleo
 * (`packages/dominio/src/nucleo/`) não chega na main. Mesmos nomes e assinaturas do núcleo: a troca
 * é só o import.
 */
import { diferencaEmDias, hojeNoFuso } from "@erp/shared/datas";

// TODO(nucleo): trocar por nucleo/tempo FUSO_DO_NEGOCIO
export const FUSO_DO_NEGOCIO = "America/Sao_Paulo";
/** Brasília não tem horário de verão desde 2019. */
const DESLOCAMENTO_SP = "-03:00";

// TODO(nucleo): trocar por nucleo/codigos CODIGOS_ENTREGA
export const CODIGOS_ENTREGA: ReadonlySet<number> = new Set([1, 18, 67]);

// TODO(nucleo): trocar por nucleo/codigos CODIGO_SAIDA_PARA_ENTREGA
export const CODIGO_SAIDA_PARA_ENTREGA = 85;

/** origem: norm_codigo_ocorr (sistema atual) */
// TODO(nucleo): trocar por nucleo/codigos normCodigoOcorr
export function normCodigoOcorr(texto: string | null): number | null {
  const digitos = (texto ?? "").replace(/\D/g, "");
  return digitos === "" ? null : Number.parseInt(digitos, 10);
}

/** origem: (instante AT TIME ZONE 'America/Sao_Paulo')::date (sistema atual) */
// TODO(nucleo): trocar por nucleo/tempo diaSp
export function diaSp(instante: Date): string {
  return hojeNoFuso(FUSO_DO_NEGOCIO, instante);
}

// TODO(nucleo): trocar por nucleo/tempo hojeSp
export function hojeSp(agora: Date): string {
  return diaSp(agora);
}

/** `a - b` em dias, como `date - date` do Postgres. */
// TODO(nucleo): trocar por nucleo/tempo difDias
export function difDias(a: string, b: string): number {
  return diferencaEmDias(b, a);
}

/** Meia-noite de Brasília do dia. */
// TODO(nucleo): trocar por nucleo/tempo inicioDoDiaSp
export function inicioDoDiaSp(dia: string): Date {
  return new Date(`${dia}T00:00:00${DESLOCAMENTO_SP}`);
}

/** origem: _is_entregue (sistema atual) */
// TODO(nucleo): trocar por nucleo/finalizacao estaEntregue
export function estaEntregue(dataEntrega: Date | null, codigoEfetivo: string | null): boolean {
  if (dataEntrega !== null) return true;
  const codigo = normCodigoOcorr(codigoEfetivo);
  return codigo !== null && CODIGOS_ENTREGA.has(codigo);
}

/** origem: _is_finalizado_sem_entrega (sistema atual); baixas = cadastro da empresa (Q22) */
// TODO(nucleo): trocar por nucleo/finalizacao estaFinalizadoSemEntrega
export function estaFinalizadoSemEntrega(
  dataEntrega: Date | null,
  codigoEfetivo: string | null,
  codigosBaixa: ReadonlySet<number>,
): boolean {
  if (dataEntrega !== null) return false;
  const codigo = normCodigoOcorr(codigoEfetivo);
  return codigo !== null && codigo !== 1 && codigosBaixa.has(codigo);
}

/**
 * Atraso pela previsão atual: entregue = dia da entrega (Brasília) − previsão; efetiva de entrega
 * sem data = `performance_dias`; baixado = vazio; aberto = hoje (Brasília) − previsão.
 * origem: atraso_lista_dias (sistema atual) e src/lib/atraso.ts
 */
// TODO(nucleo): trocar por nucleo/situacao atrasoDias
export function atrasoDias(
  cte: {
    dataPrevistaEntrega: string | null;
    dataEntregaRealizada: Date | null;
    ocorrEfetivaCodigo: string | null;
    performanceDias: number | null;
  },
  codigosBaixa: ReadonlySet<number>,
  agora: Date,
): number | null {
  const prevista = cte.dataPrevistaEntrega;
  if (prevista === null) return null;
  if (cte.dataEntregaRealizada !== null) return difDias(diaSp(cte.dataEntregaRealizada), prevista);
  const codigo = normCodigoOcorr(cte.ocorrEfetivaCodigo);
  if (codigo !== null && CODIGOS_ENTREGA.has(codigo)) return cte.performanceDias;
  if (codigo !== null && codigosBaixa.has(codigo)) return null;
  return difDias(hojeSp(agora), prevista);
}
