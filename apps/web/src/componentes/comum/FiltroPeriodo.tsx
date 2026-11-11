import { formatarData } from "@erp/shared/formatacao";
import { Calendar as IconeCalendario } from "lucide-react";
import { useState } from "react";
import { type DateRange } from "react-day-picker";

import { Calendar } from "@/componentes/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";
import { dataDoCalendario, isoDoCalendario } from "@/lib/dia-do-calendario";
import { cn } from "@/lib/utils";

import { GatilhoFiltro } from "./GatilhoFiltro";
import { type AtalhoPeriodo, type Periodo, ROTULO_ATALHO } from "./periodo";

interface MudancaPeriodo {
  periodo: Periodo;
  de: string;
  ate: string;
}

interface FiltroPeriodoProps {
  periodo: Periodo;
  /** Datas do intervalo personalizado ("" quando não há). */
  de: string;
  ate: string;
  aoMudar: (mudanca: MudancaPeriodo) => void;
  /** Padrão: Hoje, 7 dias, 30 dias, Mês. */
  atalhos?: readonly AtalhoPeriodo[] | undefined;
  /** Para onde volta ao limpar o intervalo personalizado. Padrão: "mes". */
  padrao?: AtalhoPeriodo | undefined;
  /** Nome da data filtrada no botão do calendário (ex.: "Entrega"). Padrão: "Período". */
  rotulo?: string | undefined;
}

const ATALHOS_PADRAO: readonly AtalhoPeriodo[] = ["hoje", "7d", "30d", "mes"];

/**
 * Atalhos de período + intervalo personalizado no calendário (dois meses, em português).
 * Guarde `periodo`, `de` e `ate` na URL e calcule o intervalo com `resolverPeriodo`.
 * origem: DateRangeButton + botões de período de comprovantes.tsx (sistema atual)
 */
export function FiltroPeriodo({
  periodo,
  de,
  ate,
  aoMudar,
  atalhos = ATALHOS_PADRAO,
  padrao = "mes",
  rotulo = "Período",
}: FiltroPeriodoProps) {
  const [aberto, setAberto] = useState(false);
  const personalizado = periodo === "custom" && Boolean(de && ate);
  const intervalo: DateRange | undefined = personalizado
    ? { from: dataDoCalendario(de), to: dataDoCalendario(ate) }
    : undefined;

  return (
    <>
      <div
        role="group"
        aria-label="Período"
        className="flex h-9 items-center rounded-lg border border-border bg-card p-0.5 shadow-cartao"
      >
        {atalhos.map((atalho) => (
          <button
            key={atalho}
            type="button"
            aria-pressed={periodo === atalho}
            onClick={() => {
              aoMudar({ periodo: atalho, de: "", ate: "" });
            }}
            className={cn(
              "h-full rounded-md px-3 text-[13px] font-medium transition-colors",
              periodo === atalho
                ? "bg-primary text-primary-foreground shadow-cartao"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {ROTULO_ATALHO[atalho]}
          </button>
        ))}
      </div>
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <GatilhoFiltro
            ativo={personalizado}
            rotulo={rotulo}
            aoLimpar={() => {
              aoMudar({ periodo: padrao, de: "", ate: "" });
            }}
          >
            <IconeCalendario className="h-4 w-4 text-muted-foreground" aria-hidden />
            {personalizado
              ? `${rotulo} · ${formatarData(de)} a ${formatarData(ate)}`
              : `${rotulo} · Personalizado`}
          </GatilhoFiltro>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={intervalo}
            onSelect={(r) => {
              if (r?.from && r.to) {
                aoMudar({
                  periodo: "custom",
                  de: isoDoCalendario(r.from),
                  ate: isoDoCalendario(r.to),
                });
                setAberto(false);
              } else if (r?.from) {
                aoMudar({
                  periodo: "custom",
                  de: isoDoCalendario(r.from),
                  ate: isoDoCalendario(r.from),
                });
              }
            }}
            autoFocus
            className="pointer-events-auto p-3"
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
