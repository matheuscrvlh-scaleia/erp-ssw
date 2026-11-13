import { type ReactNode } from "react";

import { InfoTip } from "@/components/common/InfoTip";

/** Título de coluna com dica ("i"); a dica não reordena nem abre nada. */
export function TituloComDica({ dica, children }: { dica: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <InfoTip texto={dica} />
    </span>
  );
}
