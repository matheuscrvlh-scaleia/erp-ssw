import { Check } from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Item de seletor próprio (Recorte, Ocorrência), no mesmo desenho do `FiltroMultiplo`. */
export function ItemMarcavel({
  marcado,
  aoAlternar,
  children,
}: {
  marcado: boolean;
  aoAlternar: () => void;
  children: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={marcado}
        onClick={aoAlternar}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-muted",
          marcado && "bg-accent text-accent-foreground",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border border-input",
            marcado && "border-primary bg-primary text-primary-foreground",
          )}
        >
          {marcado && <Check className="h-2.5 w-2.5" />}
        </span>
        {children}
      </button>
    </li>
  );
}
