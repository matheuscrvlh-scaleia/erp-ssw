/** Situação do SLA nas telas do Prazo do parceiro (cartões e tabela). */
import { type StatusKpi } from "@/components/common/KpiCard";

/** Meta e alerta do SLA da empresa (frações). */
export interface Sla {
  meta: number;
  alerta: number;
}

export function tomDoSla(p: number, sla: Sla): StatusKpi {
  if (p >= sla.meta) return "bom";
  if (p >= sla.alerta) return "alerta";
  return "ruim";
}
