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
  bom: "var(--status-good)",
  alerta: "var(--status-warn)",
  ruim: "var(--status-bad)",
};
export const textoDoStatus: Record<Status, string> = {
  bom: "var(--status-good-fg)",
  alerta: "var(--status-warn-fg)",
  ruim: "var(--status-bad-fg)",
};
export const fundoDoStatus: Record<Status, string> = {
  bom: "var(--status-good-bg)",
  alerta: "var(--status-warn-bg)",
  ruim: "var(--status-bad-bg)",
};
