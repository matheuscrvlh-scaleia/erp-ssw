import { type Status } from "@erp/dominio/performance/tela";

/** Cores de cada status (bom, alerta, ruim) nos cards e na tabela da Performance. */

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
