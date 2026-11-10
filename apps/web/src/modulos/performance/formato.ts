import { type Status } from "@erp/dominio/performance/tela";

/** Fração → "95.0%" (mesmo formato dos cards de hoje). */
export const fmtPct = (fracao: number): string => `${(fracao * 100).toFixed(1)}%`;

/** Percentual já em 0–100 → "95,0%" (cards de produção e relatório). */
export const fmtPct100 = (v: number | null): string =>
  v == null ? "—" : `${v.toFixed(1).replace(".", ",")}%`;

export const fmtInt = (v: number): string => v.toLocaleString("pt-BR");

export const fmtBRL = (v: number): string =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function fmtPeso(kg: number): string {
  if (!kg) return "0 kg";
  if (kg >= 1000) return `${(kg / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} t`;
  return `${kg.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg`;
}

export const corDoStatus: Record<Status, string> = {
  good: "var(--status-good)",
  warn: "var(--status-warn)",
  bad: "var(--status-bad)",
};
export const textoDoStatus: Record<Status, string> = {
  good: "var(--status-good-fg)",
  warn: "var(--status-warn-fg)",
  bad: "var(--status-bad-fg)",
};
export const fundoDoStatus: Record<Status, string> = {
  good: "var(--status-good-bg)",
  warn: "var(--status-warn-bg)",
  bad: "var(--status-bad-bg)",
};
