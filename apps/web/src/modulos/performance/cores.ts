import { type Status } from "@erp/dominio/performance/tela";

/** Cor de cada status (bom, alerta, ruim) nas barras da Performance. */
export const corDoStatus: Record<Status, string> = {
  bom: "var(--status-good)",
  alerta: "var(--status-warn)",
  ruim: "var(--status-bad)",
};
