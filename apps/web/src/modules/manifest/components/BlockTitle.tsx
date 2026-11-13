import { type ReactNode } from "react";

import { InfoTip } from "@/components/common/InfoTip";

/** Título de bloco com o "i" da explicação ao lado. */
export function TituloDoBloco({ dica, children }: { dica: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {children}
      <InfoTip texto={dica} />
    </span>
  );
}
