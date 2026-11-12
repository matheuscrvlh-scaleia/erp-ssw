import { type ReactNode } from "react";

/** Explicação longa do indicador no passar do mouse (o `KpiCard` não tem dica própria). */
export function ComDica({ dica, children }: { dica: string; children: ReactNode }) {
  return (
    <div title={dica} className="flex min-w-0">
      {children}
    </div>
  );
}
