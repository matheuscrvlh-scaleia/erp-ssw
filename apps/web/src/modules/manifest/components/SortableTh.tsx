import { type OrdemLista } from "@erp/shared/contracts/manifest";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Cabeçalho que ordena a lista no servidor (mesmo visual dos outros cabeçalhos). */
export function ThOrdenavel({
  coluna,
  rotulo,
  ordem,
  dir,
  aoOrdenar,
  direita,
  fixa,
  antes,
}: {
  coluna: OrdemLista;
  rotulo: string;
  ordem: OrdemLista | undefined;
  dir: "asc" | "desc";
  aoOrdenar: (c: OrdemLista) => void;
  direita?: boolean;
  fixa?: boolean;
  /** Antes do rótulo (a caixa de seleção da coluna fixa). */
  antes?: ReactNode;
}) {
  const ativa = ordem === coluna;
  const Icone = ativa ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th
      scope="col"
      aria-sort={ativa ? (dir === "asc" ? "ascending" : "descending") : undefined}
      className={cn(
        "px-4 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.04em] whitespace-nowrap uppercase",
        direita && "text-right",
        fixa && "sticky left-0 z-10 bg-muted",
      )}
    >
      {antes ? <span className="mr-2 inline-flex align-middle normal-case">{antes}</span> : null}
      <button
        type="button"
        onClick={() => {
          aoOrdenar(coluna);
        }}
        className={cn(
          "inline-flex items-center gap-0.5 uppercase hover:text-foreground",
          ativa && "text-foreground",
        )}
      >
        {rotulo}
        <Icone className={cn("ml-1 h-3 w-3", !ativa && "opacity-50")} aria-hidden />
      </button>
    </th>
  );
}
