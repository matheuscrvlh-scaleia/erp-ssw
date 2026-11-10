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

import { type CartaoDeAlerta, type IconeDoAlerta } from "../alertas";

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
      <section aria-label="Alertas operacionais" className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] tracking-wide text-muted-foreground uppercase">
            Alertas operacionais
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                <Info className="h-3 w-3" />
                sempre por emissão
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-[280px] text-[11px]">
              Alertas operacionais sempre por data de emissão e vencimento; não seguem o alternador
              Emitidos/Data Prevista/Concluídos acima. Vale também para os detalhamentos abertos a
              partir deles.
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {cartoes.map((c) => {
            const Icone = ICONE[c.chave];
            return (
              <button
                key={c.chave}
                type="button"
                onClick={() => { onClique(c); }}
                className="group relative flex items-start gap-3 rounded-[10px] border border-border/70 bg-card px-4 py-3 pr-9 text-left transition-colors hover:bg-muted/40 focus:ring-2 focus:ring-[var(--brand)]/40 focus:outline-none"
              >
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: `color-mix(in oklab, ${c.cor} 15%, transparent)`,
                    color: c.cor,
                  }}
                >
                  <Icone className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-foreground">
                    {c.titulo}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
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
                      className="absolute top-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-[320px] text-[11px] leading-relaxed">
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
