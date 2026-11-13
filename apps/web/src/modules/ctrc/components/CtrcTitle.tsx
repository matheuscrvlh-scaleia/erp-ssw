import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function TituloDoCtrc({ rotulo, principal }: { rotulo: "NF" | "CTRC"; principal: string }) {
  const semNf = rotulo === "CTRC";
  const classe = cn(
    "mr-2 align-middle text-[13px] font-semibold tracking-normal text-muted-foreground",
    semNf && "cursor-help underline decoration-dotted underline-offset-2",
  );
  return (
    <>
      {semNf ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={classe}>{rotulo}</span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            Número da NF ainda não recebido. Ele vem do BI2 (relatório 0174), que roda em D-1. Assim
            que o próximo ciclo cobrir este CTRC, a NF aparece aqui automaticamente.
          </TooltipContent>
        </Tooltip>
      ) : (
        <span className={classe}>{rotulo}</span>
      )}
      <span className="font-mono text-brand">{principal}</span>
    </>
  );
}
