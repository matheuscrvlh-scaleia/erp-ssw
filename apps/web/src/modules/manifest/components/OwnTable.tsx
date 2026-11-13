// Tabela própria com o visual da TabelaDados (cabeçalhos com dica, colunas dinâmicas).
import { type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function TabelaPropria({
  className,
  children,
}: {
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className={cn("rolagem-fina overflow-x-auto", className)}>
      <table className="w-full text-[13px] tabular-nums">{children}</table>
    </div>
  );
}

/**
 * Linha da tabela; com `aoClicar` vira clicável pelo mouse e pelo teclado (Enter/Espaço na
 * própria linha, não nos botões de dentro dela).
 */
export function propsDaLinha(aoClicar: (() => void) | undefined, classe?: string) {
  const base = cn(
    "border-b border-border transition-colors last:border-0 hover:bg-muted/60",
    aoClicar && "cursor-pointer focus-visible:bg-accent focus-visible:outline-none",
    classe,
  );
  if (!aoClicar) return { className: base };
  return {
    className: base,
    tabIndex: 0,
    onClick: aoClicar,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        aoClicar();
      }
    },
  };
}
