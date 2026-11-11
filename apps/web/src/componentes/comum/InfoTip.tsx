import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/componentes/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Ícone "i" com a explicação da regra ou do número, no passar do mouse ou no foco do teclado.
 * Dentro de card clicável, o clique no ícone não aciona o card.
 */
export function InfoTip({ texto, className }: { texto: string; className?: string | undefined }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={texto}
            onClick={(e) => {
              e.stopPropagation();
            }}
            className={cn(
              "inline-flex shrink-0 text-muted-foreground/70 transition-colors hover:text-foreground",
              className,
            )}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[300px] text-[12px] leading-snug">
          {texto}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
