import { formatarDataHora } from "@erp/shared/formatacao";

/** Data e hora de exibição; sem data, "—". */
export const dataHora = (iso: string | null | undefined) => (iso ? formatarDataHora(iso) : "—");

/** Número com separador de milhar; o que não é número vira "—". */
export const num = (v: unknown) => (typeof v === "number" ? v.toLocaleString("pt-BR") : "—");
