import { type StatusDeComprovante } from "@erp/shared/contratos/comprovantes";
import { formatarPercentual } from "@erp/shared/formatacao";

/** Título da lista lateral e da exportação, pelo card que a abriu. */
export const TITULO_DO_STATUS: Record<StatusDeComprovante, string> = {
  todos: "CT-e entregues",
  digitalizados: "Comprovantes digitalizados",
  pendentes: "Comprovantes pendentes",
};

/** Percentual de digitalizados; sem entregue no recorte, um travessão. */
export const pct = (p: number | null) => (p === null ? "—" : formatarPercentual(p));
