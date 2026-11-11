/** Situação do SLA nas telas do Prazo do parceiro (cartões e tabela). */
import { type StatusKpi } from "@/componentes/comum/KpiCard";
import { type Tom } from "@/componentes/comum/SeloStatus";

/** Meta e alerta do SLA da empresa (frações). */
interface Sla {
  meta: number;
  alerta: number;
}

export function tomDoSla(p: number, sla: Sla): StatusKpi {
  if (p >= sla.meta) return "bom";
  if (p >= sla.alerta) return "alerta";
  return "ruim";
}

/** O mesmo tom no `SeloStatus` (tabela). */
export const SELO_DO_SLA: Record<StatusKpi, Tom> = {
  bom: "sucesso",
  alerta: "alerta",
  ruim: "erro",
};
