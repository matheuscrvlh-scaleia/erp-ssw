import { formatarData } from "@erp/shared/formatacao";
import { Calendar as IconeCalendario } from "lucide-react";
import { useState } from "react";
import { type DateRange } from "react-day-picker";

import { Calendar } from "@/componentes/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";
import { cn } from "@/lib/utils";

import { GatilhoFiltro } from "./GatilhoFiltro";
import { type AtalhoPeriodo, type Periodo, ROTULO_ATALHO } from "./periodo";

/** Dia do calendário (meia-noite local) ↔ "AAAA-MM-DD", sem passar por UTC. */
function paraData(iso: string): Date {
  const [ano = 1970, mes = 1, dia = 1] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}
function paraIso(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${String(data.getFullYear())}-${mes}-${dia}`;
}

export interface MudancaPeriodo {
  periodo: Periodo;
  de: string;
  ate: string;
}

export interface FiltroPeriodoProps {
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
    ? { from: paraData(de), to: paraData(ate) }
    : undefined;

  return (
    <>
      <div
        role="group"
        aria-label="Período"
        className="flex rounded-md border border-border/70 p-0.5"
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
              "rounded-[5px] px-3 py-1 text-[12px] transition-colors",
              periodo === atalho
                ? "bg-[var(--brand)] text-white"
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
            <IconeCalendario className="h-3 w-3" aria-hidden />
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
                aoMudar({ periodo: "custom", de: paraIso(r.from), ate: paraIso(r.to) });
                setAberto(false);
              } else if (r?.from) {
                aoMudar({ periodo: "custom", de: paraIso(r.from), ate: paraIso(r.from) });
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
