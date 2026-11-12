import { type ReactNode } from "react";

import { SeloStatus } from "@/componentes/comum/SeloStatus";

/** Texto curto sem situação (origem do prazo, responsável da ocorrência). */
export function Etiqueta({ children }: { children: ReactNode }) {
  return (
    <SeloStatus tom="neutro" semIcone>
      {children}
    </SeloStatus>
  );
}
