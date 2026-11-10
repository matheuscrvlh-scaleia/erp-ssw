import { ErroDeConversao } from "./erros";

const NUMERIC = /^(-?)(\d+)(?:\.(\d+))?$/;

/**
 * `numeric` (texto do Postgres) → `numeric(precisao, escala)` em texto com a escala fixa. Casa
 * decimal além da escala só passa se forem zeros (`10.500` → `10.50`); qualquer outra coisa é
 * erro: arredondar mudaria o valor de dinheiro/peso sem ninguém ver.
 */
export function decimal(
  valor: string | null,
  coluna: string,
  precisao: number,
  escala: number,
): string | null {
  if (valor === null) return null;
  const partes = NUMERIC.exec(valor.trim());
  if (!partes) throw new ErroDeConversao(coluna, valor, "não é um número decimal");
  const [, sinal = "", inteiraBruta = "", fracaoBruta = ""] = partes;
  const excedente = fracaoBruta.slice(escala);
  if (/[^0]/.test(excedente)) {
    throw new ErroDeConversao(coluna, valor, `tem mais de ${escala} casas decimais`);
  }
  const inteira = inteiraBruta.replace(/^0+(?=\d)/, "");
  if (inteira !== "0" && inteira.length > precisao - escala) {
    throw new ErroDeConversao(coluna, valor, `não cabe em numeric(${precisao},${escala})`);
  }
  const fracao = fracaoBruta.slice(0, escala).padEnd(escala, "0");
  const zero = /^0+$/.test(inteira + fracao);
  const texto = escala > 0 ? `${inteira}.${fracao}` : inteira;
  return zero ? texto : `${sinal}${texto}`;
}

export const dinheiro = (valor: string | null, coluna: string) => decimal(valor, coluna, 14, 2);
export const peso = (valor: string | null, coluna: string) => decimal(valor, coluna, 12, 3);

/** Inteiro dentro de uma faixa (ex.: `integer` → `smallint`); fora dela é erro, nunca corte. */
export function inteiroNaFaixa(
  valor: number | null,
  coluna: string,
  minimo: number,
  maximo: number,
): number | null {
  if (valor === null) return null;
  if (!Number.isInteger(valor) || valor < minimo || valor > maximo) {
    throw new ErroDeConversao(coluna, String(valor), `fora da faixa ${minimo}–${maximo}`);
  }
  return valor;
}

export const smallint = (valor: number | null, coluna: string) =>
  inteiroNaFaixa(valor, coluna, -32_768, 32_767);

/** Código de ocorrência do catálogo novo: `smallint` com `check (codigo between 0 and 99)`. */
export const codigoDeOcorrencia = (valor: number, coluna: string): number =>
  inteiroNaFaixa(valor, coluna, 0, 99) ?? valor;
