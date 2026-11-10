import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/componentes/ui/tooltip";

/** Ícone "i" com a explicação da regra no passar do mouse (ou no foco do teclado). */
export function InfoTip({ texto }: { texto: string }) {
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
            className="inline-flex text-muted-foreground/70 hover:text-foreground"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-[320px] text-[12px] leading-snug">{texto}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
