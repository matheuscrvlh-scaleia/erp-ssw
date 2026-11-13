import { formatarInteiro } from "@erp/shared/formatting";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** Barras horizontais por faixa de atraso, com dica no passar do mouse e no foco do teclado. */
export function GraficoAtrasoNaOrigem({
  faixas,
}: {
  faixas: readonly { faixa: string; qtd: number }[];
}) {
  const maior = Math.max(1, ...faixas.map((h) => h.qtd));
  return (
    <TooltipProvider delayDuration={80}>
      <ul className="space-y-2.5">
        {faixas.map((h) => {
          const texto = `${h.faixa}: ${formatarInteiro(h.qtd)} CTRC(s)`;
          return (
            <li key={h.faixa} className="flex items-center gap-3 text-[13px]">
              <span className="w-24 shrink-0 text-muted-foreground">{h.faixa}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    role="img"
                    tabIndex={0}
                    aria-label={texto}
                    className="group h-3.5 flex-1 rounded-full bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span
                      className="block h-full rounded-full bg-status-bad transition-opacity group-hover:opacity-80"
                      style={{ width: `${String((h.qtd / maior) * 100)}%` }}
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[12px]">
                  {texto}
                </TooltipContent>
              </Tooltip>
              <span className="w-12 shrink-0 text-right font-semibold tabular-nums">
                {formatarInteiro(h.qtd)}
              </span>
            </li>
          );
        })}
      </ul>
    </TooltipProvider>
  );
}
