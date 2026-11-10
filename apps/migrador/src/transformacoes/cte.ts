/**
 * Identidade do CT-e e colunas derivadas de texto. Mesma semântica das funções SQL do sistema
 * atual, para o primeiro dia bater.
 */
import { btrim } from "@erp/dominio/nucleo";

/** Só os dígitos; texto sem dígito vira nulo. origem: regexp_replace(x, '\D', '', 'g') das RPCs */
export function digitos(valor: string | null): string | null {
  const d = (valor ?? "").replace(/\D/g, "");
  return d === "" ? null : d;
}

/** `upper(btrim(x))`, com vazio = nulo (`btrim` do Postgres: só espaço). */
export function maiusculaAparada(valor: string | null): string | null {
  const v = btrim(valor ?? "").toUpperCase();
  return v === "" ? null : v;
}

/** Sigla do campo de CT-e de um relatório ("CAP033214-5" → "CAP"). origem: ssw_sigla_ctrc */
export function siglaSsw(campo: string | null): string | null {
  const letras = /^([A-Za-z]+)/.exec(btrim(campo ?? ""));
  return letras?.[1] ? letras[1].toUpperCase() : null;
}

/** Número do campo de CT-e de um relatório ("CAP033214-5" → "33214"). origem: ssw_num_ctrc */
export function numeroSsw(campo: string | null): string | null {
  const antesDoTraco = btrim(campo ?? "").split("-")[0] ?? "";
  const d = digitos(antesDoTraco);
  return d === null ? null : d.replace(/^0+(?=\d)/, "");
}

/**
 * `ctrcs.numero_ctrc` → `ctes.numero`: a parte antes de `/` (o CT-e antigo "estacionado" é
 * `'<num>/<sigla>'`), com a regra do `ssw_num_ctrc`.
 */
export function numeroDoCte(numeroCtrc: string): string | null {
  return numeroSsw(numeroCtrc.split("/")[0] ?? "");
}

/** Sufixo depois de `/` no número do CT-e estacionado ("33214/CAP" → "CAP"). */
export function siglaDoSufixo(numeroCtrc: string): string | null {
  const barra = numeroCtrc.indexOf("/");
  return barra < 0 ? null : maiusculaAparada(numeroCtrc.slice(barra + 1));
}

/**
 * `ctes.sigla`: `upper(btrim(sigla_ctrc))`; se nula, o sufixo do número estacionado; se ainda
 * nula, a sigla que o 455 deu para o mesmo número e emissão.
 */
export function siglaDoCte(
  siglaCtrc: string | null,
  numeroCtrc: string,
  siglaDo455: string | null,
): string | null {
  return maiusculaAparada(siglaCtrc) ?? siglaDoSufixo(numeroCtrc) ?? siglaDo455;
}

export const NUMERO_DE_CTE_VALIDO = /^[1-9][0-9]*$/;
export const SIGLA_DE_CTE_VALIDA = /^[A-Z]+$/;
