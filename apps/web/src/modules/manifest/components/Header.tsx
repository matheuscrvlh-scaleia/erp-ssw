import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Linha de cabeçalho (fundo `muted`, rótulos em caixa alta). */
export function Cabecalho({
  fixo,
  children,
}: {
  /** Gruda no topo da área com rolagem. */
  fixo?: boolean | undefined;
  children: ReactNode;
}) {
  return (
    <thead className={cn(fixo && "sticky top-0 z-[6]")}>
      <tr className="border-b border-border bg-muted text-muted-foreground">{children}</tr>
    </thead>
  );
}
