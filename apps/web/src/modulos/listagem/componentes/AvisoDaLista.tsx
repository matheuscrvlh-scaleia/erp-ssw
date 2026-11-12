import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Linha de aviso (carregando, vazio, erro) dentro da lista de um seletor próprio. */
export function AvisoDaLista({ children, erro }: { children: ReactNode; erro?: boolean }) {
  return (
    <li
      className={cn(
        "px-3 py-3 text-center text-[12.5px] text-muted-foreground",
        erro && "text-status-bad-fg",
      )}
    >
      {children}
    </li>
  );
}
