import {
  AlertCircle,
  CalendarClock,
  Clock,
  Info,
  type LucideIcon,
  PackageX,
  Repeat2,
  Timer,
  TrafficCone,
  TrendingDown,
  WifiOff,
} from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/componentes/ui/tooltip";

import { type CartaoDeAlerta, type IconeDoAlerta } from "../regras";

const ICONE: Record<IconeDoAlerta, LucideIcon> = {
  abaixo: AlertCircle,
  parado: Clock,
  queda: TrendingDown,
  vencendo: Timer,
  nascido: CalendarClock,
  finalizados: PackageX,
  semAtualizacao: WifiOff,
  oc13: TrafficCone,
  oc13Multipla: Repeat2,
};

/** Banner "Alertas operacionais": some quando nenhum alerta disparou. */
export function BannerDeAlertas({
  cartoes,
  onClique,
}: {
  cartoes: readonly CartaoDeAlerta[];
  onClique: (c: CartaoDeAlerta) => void;
}) {
  if (cartoes.length === 0) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <section aria-label="Alertas operacionais" className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[16px] font-bold tracking-[-0.01em] text-foreground">
            Alertas operacionais
          </h2>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex h-6 cursor-help items-center gap-1 rounded-full border border-border bg-muted px-2 text-[12px] font-medium text-muted-foreground"
              >
                <Info className="h-3.5 w-3.5" aria-hidden />
                sempre por emissão
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[280px] text-[12px]">
              Alertas operacionais sempre por data de emissão e vencimento; não seguem o alternador
              Emitidos/Data Prevista/Concluídos acima. Vale também para os detalhamentos abertos a
              partir deles.
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cartoes.map((c) => {
            const Icone = ICONE[c.chave];
            return (
              <button
                key={c.chave}
                type="button"
                onClick={() => {
                  onClique(c);
                }}
                className="group relative flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 pr-10 text-left shadow-cartao transition-[box-shadow,border-color] hover:border-brand/40 hover:shadow-flutuante focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: `color-mix(in oklab, ${c.cor} 15%, transparent)`,
                    color: c.cor,
                  }}
                >
                  <Icone className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-foreground">
                    {c.titulo}
                  </span>
                  <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">
                    {c.subtitulo}
                  </span>
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Sobre este alerta"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          e.preventDefault();
                        }
                      }}
                      className="absolute top-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Info className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-[320px] text-[12px] leading-relaxed">
                    {c.explicacao}
                  </TooltipContent>
                </Tooltip>
              </button>
            );
          })}
        </div>
      </section>
    </TooltipProvider>
  );
}
