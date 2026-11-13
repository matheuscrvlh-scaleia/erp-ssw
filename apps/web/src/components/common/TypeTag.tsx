import { type Feriado } from "@erp/shared/contracts/calendar";

import { cn } from "@/lib/utils";

import { corDoTipo, PONTO_DO_TIPO } from "./holiday-type";

/** Selo do tipo de feriado (texto + cor da categoria). */
export function EtiquetaDoTipo({ tipo }: { tipo: Feriado["tipo"] }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-[12px] font-semibold capitalize",
        corDoTipo(tipo),
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", PONTO_DO_TIPO[tipo])} />
      {tipo}
    </span>
  );
}
