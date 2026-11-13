import { type SaidaDe } from "@erp/shared/contract";
import { type contratosPrazoParceiro } from "@erp/shared/contracts/partner-deadline";
import { formatarInteiro, formatarPercentual } from "@erp/shared/formatting";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { COR_DA_ORIGEM } from "../texts";

type TotaisDoPrazo = SaidaDe<typeof contratosPrazoParceiro.visaoGeral>["totais"];

/**
 * Barra 100% empilhada da origem do prazo (2 partes): dica no passar do mouse e no foco; a parte
 * do parceiro filtra a lista abaixo.
 */
export function GraficoOrigemDoPrazo({
  totais: t,
  aoVerParceiro,
}: {
  totais: TotaisDoPrazo;
  aoVerParceiro: () => void;
}) {
  const partes = [
    {
      chave: "proprio" as const,
      rotulo: "Prazo próprio",
      qtd: t.totalProprio,
      pct: t.pctPrazoProprio,
    },
    {
      chave: "parceiro" as const,
      rotulo: "Prazo do parceiro",
      qtd: t.totalParceiro,
      pct: t.pctPrazoParceiro,
    },
  ];
  const dica = (p: (typeof partes)[number]) =>
    `${p.rotulo}: ${formatarInteiro(p.qtd)} (${formatarPercentual(p.pct, { casas: 0 })})`;
  return (
    <TooltipProvider delayDuration={80}>
      <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
        {partes.map((p) => {
          const estilo = { width: `${String(p.pct * 100)}%`, background: COR_DA_ORIGEM[p.chave] };
          const classe =
            "h-full min-w-1 transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
          return (
            <Tooltip key={p.chave}>
              <TooltipTrigger asChild>
                {p.chave === "parceiro" ? (
                  <button
                    type="button"
                    aria-label={dica(p)}
                    onClick={aoVerParceiro}
                    className={cn(classe, "cursor-pointer")}
                    style={estilo}
                  />
                ) : (
                  <span
                    role="img"
                    tabIndex={0}
                    aria-label={dica(p)}
                    className={classe}
                    style={estilo}
                  />
                )}
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[12px]">
                {dica(p)}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        {partes.map((p) => (
          <div key={p.chave}>
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-[3px]"
                style={{ background: COR_DA_ORIGEM[p.chave] }}
              />
              {p.rotulo}
            </div>
            <div className="mt-1 text-[18px] font-bold text-foreground tabular-nums">
              {formatarInteiro(p.qtd)}{" "}
              <span className="text-[12.5px] font-medium text-muted-foreground">
                ({formatarPercentual(p.pct, { casas: 0 })})
              </span>
            </div>
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
