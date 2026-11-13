/** Etiqueta da origem do prazo (próprio ou parceiro) na lista de CT-e. */
import { cn } from "@/lib/utils";

import { COR_DA_ORIGEM } from "../texts";

export function EtiquetaDeOrigem({ origem }: { origem: "proprio" | "parceiro" }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-[12px] font-semibold",
        origem === "parceiro"
          ? "border-serie-2/40 bg-serie-2/12 text-foreground"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: COR_DA_ORIGEM[origem] }}
      />
      {origem === "parceiro" ? "Parceiro" : "Próprio"}
    </span>
  );
}
