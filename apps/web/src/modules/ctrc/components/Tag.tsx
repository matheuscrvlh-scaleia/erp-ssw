import { type ReactNode } from "react";

import { SeloStatus } from "@/components/common/StatusBadge";

/** Texto curto sem situação (origem do prazo, responsável da ocorrência). */
export function Etiqueta({ children }: { children: ReactNode }) {
  return (
    <SeloStatus tom="neutro" semIcone>
      {children}
    </SeloStatus>
  );
}
