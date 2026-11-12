import { type ResponsavelDoEvento } from "@erp/shared/contratos/ocorrencias";
import { type ReactNode } from "react";

import { SeloStatus } from "@/componentes/comum/SeloStatus";

import { tomDoResponsavel } from "../textos";

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
