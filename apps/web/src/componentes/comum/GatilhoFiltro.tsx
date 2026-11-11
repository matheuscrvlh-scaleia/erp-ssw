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
        "inline-flex h-9 items-center rounded-lg border border-border bg-card text-[13px] shadow-cartao",
        ativo && "border-brand/60 bg-brand-suave",
      )}
    >
      <button
        ref={ref}
        type="button"
        className={cn(
          "inline-flex h-full items-center gap-2 rounded-lg px-3 font-medium hover:bg-muted",
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
          className="-ml-1.5 mr-1.5 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </span>
  ),
);
GatilhoFiltro.displayName = "GatilhoFiltro";
