/**
 * Identidade do CT-e e colunas derivadas de texto. Mesma semântica das funções SQL do sistema
 * atual, para o primeiro dia bater.
 */

/** Só os dígitos; texto sem dígito vira nulo. origem: regexp_replace(x, '\D', '', 'g') das RPCs */
export function digitos(valor: string | null): string | null {
  const d = (valor ?? "").replace(/\D/g, "");
  return d === "" ? null : d;
}

/** `upper(btrim(x))`, com vazio = nulo. */
export function maiusculaAparada(valor: string | null): string | null {
  const v = (valor ?? "").trim().toUpperCase();
  return v === "" ? null : v;
}

/** Sigla do campo de CT-e de um relatório ("CAP033214-5" → "CAP"). origem: ssw_sigla_ctrc */
export function siglaSsw(campo: string | null): string | null {
  const letras = /^([A-Za-z]+)/.exec((campo ?? "").trim());
  return letras?.[1] ? letras[1].toUpperCase() : null;
}

/** Número do campo de CT-e de um relatório ("CAP033214-5" → "33214"). origem: ssw_num_ctrc */
export function numeroSsw(campo: string | null): string | null {
  const antesDoTraco = (campo ?? "").trim().split("-")[0] ?? "";
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

/**
 * Código de ocorrência como número: tira todo caractere que não é dígito. origem:
 * norm_codigo_ocorr (docs/regras/01 §2.1).
 */
export function normCodigoOcorr(texto: string | null): number | null {
  const d = digitos(texto);
  return d === null ? null : Number.parseInt(d, 10);
}

/**
 * A sigla que decide o universo e o filtro de filial. `coalesce` do SQL: só nulo passa adiante
 * (texto vazio fica). origem: expressão repetida nas RPCs
 */
export function filialEfetiva(
  unidadeDestino: string | null,
  unidadeAtual: string | null,
  filial: string | null,
): string | null {
  return unidadeDestino ?? unidadeAtual ?? filial;
}
