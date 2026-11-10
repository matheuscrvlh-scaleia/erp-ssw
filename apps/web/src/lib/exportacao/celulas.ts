import { FUSO_DO_NEGOCIO, relogioNoFuso } from "@erp/dominio/nucleo/tempo";
import { hojeNoFuso } from "@erp/shared/datas";
import {
  formatarData,
  formatarDataHora,
  formatarDecimal,
  formatarInteiro,
  formatarMoeda,
  formatarPercentual,
} from "@erp/shared/formatacao";

import { type FormatoColuna } from "./tipos";

/**
 * Valor de cada célula conforme o formato da coluna e o destino: texto da tela/PDF/impressão,
 * texto do CSV (para reimportar) ou valor nativo do Excel (número e data de verdade).
 * Vazio (null, undefined, "") sai sempre como célula vazia, nunca "—".
 */

export const FUSO_PADRAO = FUSO_DO_NEGOCIO;

export function valorDaLinha(linha: object, chave: string): unknown {
  if (!(chave in linha)) return undefined;
  const valor: unknown = Reflect.get(linha, chave);
  return valor;
}

function vazio(valor: unknown): valor is null | undefined | "" {
  return valor == null || valor === "";
}

/** Número, ou texto numérico (o `numeric` do Postgres chega como texto). */
export function paraNumero(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "string" && /^-?\d+(\.\d+)?$/.test(valor.trim())) return Number(valor);
  return null;
}

function paraInstante(valor: unknown): Date | null {
  const data = valor instanceof Date ? valor : typeof valor === "string" ? new Date(valor) : null;
  return data && !Number.isNaN(data.getTime()) ? data : null;
}

/**
 * Dia de calendário "AAAA-MM-DD". Data pura não passa por `Date` (cairia no dia anterior em
 * Brasília); instante com hora vira o dia no fuso da empresa.
 */
export function paraDiaIso(valor: unknown, fuso: string): string | null {
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  const instante = paraInstante(valor);
  return instante ? hojeNoFuso(fuso, instante) : null;
}

function textoLivre(valor: unknown): string {
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (Array.isArray(valor)) return valor.map(textoLivre).join(", ");
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === "string" || typeof valor === "number" || typeof valor === "bigint") {
    return String(valor);
  }
  return "";
}

/** Texto como aparece na tela, no PDF e na impressão. */
export function textoDaCelula(
  valor: unknown,
  formato: FormatoColuna = "texto",
  fuso = FUSO_PADRAO,
): string {
  if (vazio(valor)) return "";
  const numero = paraNumero(valor);
  switch (formato) {
    case "inteiro":
      return numero == null ? textoLivre(valor) : formatarInteiro(numero);
    case "decimal":
      return numero == null ? textoLivre(valor) : formatarDecimal(numero);
    case "percentual":
      return numero == null ? textoLivre(valor) : formatarPercentual(numero);
    case "moeda":
      return numero == null ? textoLivre(valor) : formatarMoeda(numero);
    case "data": {
      const dia = paraDiaIso(valor, fuso);
      return dia ? formatarData(dia) : textoLivre(valor);
    }
    case "datahora": {
      const instante = paraInstante(valor);
      return instante ? formatarDataHora(instante.toISOString(), fuso) : textoLivre(valor);
    }
    case "texto":
      return textoLivre(valor);
  }
}

/**
 * Texto do CSV: só dados, no padrão do Excel em português (separador ";", vírgula decimal, sem
 * separador de milhar), para reimportar sem perder número nem data.
 */
export function textoCsv(valor: unknown, formato: FormatoColuna = "texto", fuso = FUSO_PADRAO) {
  if (vazio(valor)) return "";
  const numero = paraNumero(valor);
  if (numero != null) {
    if (formato === "moeda") return numero.toFixed(2).replace(".", ",");
    if (formato === "percentual") return formatarPercentual(numero);
    if (formato === "inteiro" || formato === "decimal") return String(numero).replace(".", ",");
  }
  return textoDaCelula(valor, formato, fuso);
}

interface CelulaExcel {
  valor: string | number | Date;
  formatoNumero?: string;
}

const FORMATO_EXCEL: Partial<Record<FormatoColuna, string>> = {
  inteiro: "#,##0",
  decimal: "#,##0.00",
  percentual: "0.0%",
  moeda: '"R$" #,##0.00',
  data: "dd/mm/yyyy",
  datahora: "dd/mm/yyyy hh:mm",
};

/** Valor nativo do Excel: número e data de verdade (filtro e soma funcionam na planilha). */
export function celulaExcel(
  valor: unknown,
  formato: FormatoColuna = "texto",
  fuso = FUSO_PADRAO,
): CelulaExcel | null {
  if (vazio(valor)) return null;
  const formatoNumero = FORMATO_EXCEL[formato];
  if (formatoNumero && formato !== "data" && formato !== "datahora") {
    const numero = paraNumero(valor);
    if (numero != null) return { valor: numero, formatoNumero };
  }
  if (formato === "data") {
    const dia = paraDiaIso(valor, fuso);
    if (dia) return { valor: new Date(`${dia}T00:00:00Z`), formatoNumero: "dd/mm/yyyy" };
  }
  if (formato === "datahora") {
    const instante = paraInstante(valor);
    if (instante)
      return { valor: relogioNoFuso(instante, fuso), formatoNumero: "dd/mm/yyyy hh:mm" };
  }
  const numero = formato === "texto" && typeof valor === "number" ? valor : null;
  return { valor: numero ?? textoLivre(valor) };
}
