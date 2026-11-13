import { type ResponsavelDoEvento } from "@erp/shared/contracts/occurrences";
import { type ReactNode } from "react";

import { SeloStatus } from "@/components/common/StatusBadge";

import { tomDoResponsavel } from "../texts";

/** Responsável do código em pílula (transportador em vermelho, pendente em alerta). */
export function SeloDoResponsavel({
  responsavel,
  children,
}: {
  responsavel: ResponsavelDoEvento;
  children: ReactNode;
}) {
  const tom = tomDoResponsavel(responsavel);
  return (
    <SeloStatus tom={tom} semIcone={tom === "neutro"} className="shrink-0">
      {children}
    </SeloStatus>
  );
}
