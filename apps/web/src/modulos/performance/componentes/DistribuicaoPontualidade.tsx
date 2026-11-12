import { formatarInteiro, formatarPercentual } from "@erp/shared/formatacao";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/componentes/ui/tooltip";

import { corDoStatus } from "../textos";

const pct1 = (v: number) => formatarPercentual(v, { escala: "cem" });

/** Distribuição da pontualidade (barra empilhada + legenda). origem: PontualidadeBreakdown.tsx */
export function DistribuicaoPontualidade({
  noPrazo,
  foraPrazo,
  excluidoCliente,
  semInfo,
  nomeCurto,
}: {
  noPrazo: number;
  foraPrazo: number;
  excluidoCliente: number;
  semInfo: number;
  nomeCurto: string;
}) {
  const total = noPrazo + foraPrazo + excluidoCliente + semInfo;
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  const segmentos = [
    {
      chave: "no_prazo",
      rotulo: "No prazo",
      valor: noPrazo,
      cor: corDoStatus.bom,
      dica: "Entregas que chegaram até a data combinada.",
    },
    {
      chave: "fora_prazo",
      rotulo: "Fora do prazo",
      valor: foraPrazo,
      cor: corDoStatus.ruim,
      dica: "Entregas que chegaram depois da data combinada.",
    },
    {
      chave: "excluido",
      rotulo: "Excluído (resp. cliente/parceiro)",
      valor: excluidoCliente,
      cor: corDoStatus.alerta,
      dica: `Atraso que não é culpa da ${nomeCurto} — o cliente ou parceiro causou o atraso, então não conta contra nós.`,
    },
    {
      chave: "sem_info",
      rotulo: "Ainda sem confirmação do SSW",
      valor: semInfo,
      cor: "var(--muted-foreground)",
      dica: "CTRCs que ainda não foram entregues, ou cuja entrega ainda não foi confirmada pelo sistema do SSW. A maioria são os 'Previstos' — ainda a caminho.",
    },
  ];
  const conteudo = (s: (typeof segmentos)[number]) => (
    <TooltipContent side="top" className="max-w-xs text-[12px] leading-relaxed">
      <div className="font-semibold">{s.rotulo}</div>
      <div className="mt-0.5 font-semibold tabular-nums">
        {formatarInteiro(s.valor)} CTRCs{total > 0 ? ` · ${pct1(pct(s.valor))}` : ""}
      </div>
      <div className="mt-1">{s.dica}</div>
    </TooltipContent>
  );
  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-3">
        {total > 0 && (
          <div
            className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label="Distribuição de pontualidade"
          >
            {segmentos
              .filter((s) => s.valor > 0)
              .map((s) => (
                <Tooltip key={s.chave}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`${s.rotulo}: ${formatarInteiro(s.valor)} (${pct1(pct(s.valor))})`}
                      className="h-full transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      style={{ width: `${Math.max(1.5, pct(s.valor))}%`, backgroundColor: s.cor }}
                    />
                  </TooltipTrigger>
                  {conteudo(s)}
                </Tooltip>
              ))}
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {segmentos.map((s) => (
            <Tooltip key={s.chave}>
              <TooltipTrigger asChild>
                <div
                  tabIndex={0}
                  className="flex min-w-0 items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                    style={{ backgroundColor: s.cor }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground">
                    {s.rotulo}
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold text-foreground tabular-nums">
                    {formatarInteiro(s.valor)}
                  </span>
                  {total > 0 && (
                    <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                      {pct1(pct(s.valor))}
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              {conteudo(s)}
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
