import { type ReactNode } from "react";

import { SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/*
 * Campos da barra de filtros com o rótulo visível dentro do controle ("Mês  nov/2026"), no mesmo
 * desenho do `GatilhoFiltro`. Usados nas telas de apuração (bonificação e ponto), que têm mês,
 * datas e escolhas únicas em vez dos seletores de CT-e.
 */

const MOLDURA =
  "inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card text-[13px] shadow-cartao";

/** Campo nativo (mês, data, texto) com o rótulo à esquerda. */
export function CampoRotulado({
  rotulo,
  htmlFor,
  children,
  className,
}: {
  rotulo: string;
  htmlFor: string;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <span className={cn(MOLDURA, "pl-3 focus-within:border-ring", className)}>
      <label htmlFor={htmlFor} className="font-medium whitespace-nowrap">
        {rotulo}
      </label>
      {children}
    </span>
  );
}

/** Classe do `<input>` dentro do `CampoRotulado`. */
export const CLASSE_DO_CAMPO =
  "h-full min-w-0 rounded-r-lg bg-transparent pr-3 text-[13px] text-muted-foreground tabular-nums outline-none";

/** Gatilho do `Select` com o rótulo antes do valor escolhido. */
export function GatilhoRotulado({
  rotulo,
  placeholder,
  className,
}: {
  rotulo: string;
  placeholder?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <SelectTrigger
      className={cn(
        MOLDURA,
        "w-auto justify-start border-border px-3 font-medium hover:bg-muted data-[placeholder]:text-foreground [&>span]:line-clamp-1",
        className,
      )}
    >
      <span className="whitespace-nowrap">{rotulo}</span>
      <span className="min-w-0 truncate font-normal text-muted-foreground">
        <SelectValue placeholder={placeholder} />
      </span>
    </SelectTrigger>
  );
}

/** Interruptor com o texto ao lado, na altura dos filtros. */
export function InterruptorRotulado({
  id,
  rotulo,
  children,
}: {
  id: string;
  rotulo: string;
  /** O `Switch` com este `id`. */
  children: ReactNode;
}) {
  return (
    <span className={cn(MOLDURA, "px-3")}>
      {children}
      <label htmlFor={id} className="cursor-pointer font-medium">
        {rotulo}
      </label>
    </span>
  );
}
