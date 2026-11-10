import { X } from "lucide-react";
import { forwardRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface GatilhoFiltroProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  ativo: boolean;
  /** Rótulo do filtro (vai no aria-label do "x"). */
  rotulo: string;
  /** Tira o filtro; com ele e `ativo`, aparece o "x". */
  aoLimpar?: (() => void) | undefined;
  children: ReactNode;
}

/**
 * Botão de filtro da barra (abre o seletor) com o "x" de limpar ao lado. O "x" é um botão irmão,
 * não aninhado: botão dentro de botão quebra o teclado e o leitor de tela.
 * Usado com `PopoverTrigger asChild`, que repassa ref e eventos para o botão principal.
 */
export const GatilhoFiltro = forwardRef<HTMLButtonElement, GatilhoFiltroProps>(
  ({ ativo, rotulo, aoLimpar, children, className, ...props }, ref) => (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border/70 bg-card text-[12px]",
        ativo && "border-[var(--brand)]",
      )}
    >
      <button
        ref={ref}
        type="button"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1 hover:bg-muted",
          className,
        )}
        {...props}
      >
        {children}
      </button>
      {ativo && aoLimpar && (
        <button
          type="button"
          onClick={aoLimpar}
          aria-label={`Limpar ${rotulo.toLowerCase()}`}
          title={`Limpar ${rotulo.toLowerCase()}`}
          data-exportacao-ignorar
          className="-ml-2 mr-1 rounded-sm p-0.5 hover:bg-muted-foreground/20"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      )}
    </span>
  ),
);
GatilhoFiltro.displayName = "GatilhoFiltro";
