import { Search } from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Caixa de texto com lupa, no desenho dos filtros (36 px). */
export function CaixaDeBusca({
  valor,
  aoMudar,
  placeholder,
  rotulo,
  ativo,
  className,
  children,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  placeholder: string;
  rotulo: string;
  ativo?: boolean | undefined;
  className?: string | undefined;
  /** Botão à direita dentro da caixa (ex.: limpar). */
  children?: ReactNode;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        value={valor}
        onChange={(e) => {
          aoMudar(e.target.value);
        }}
        placeholder={placeholder}
        aria-label={rotulo}
        className={cn(
          "h-9 w-full rounded-lg border border-border bg-card pr-8 pl-9 text-[13px] shadow-cartao outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
          ativo && "border-brand/60 bg-brand-suave",
        )}
      />
      {children}
    </div>
  );
}
