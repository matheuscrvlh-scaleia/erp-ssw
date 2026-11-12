import { formatarData } from "@erp/shared/formatacao";
import { CalendarDays } from "lucide-react";
import { useState } from "react";

import { GatilhoFiltro } from "@/componentes/comum/GatilhoFiltro";
import { Calendar } from "@/componentes/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";
import { dataDoCalendario, isoDoCalendario } from "@/lib/dia-do-calendario";

/** Data prevista de entrega (um dia só). */
export function FiltroPrevisao({
  valor,
  aoMudar,
}: {
  valor: string;
  aoMudar: (v: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <GatilhoFiltro
          ativo={Boolean(valor)}
          rotulo="Data prevista"
          aoLimpar={() => {
            aoMudar("");
          }}
        >
          <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
          {valor ? `Data prevista · ${formatarData(valor)}` : "Data prevista"}
        </GatilhoFiltro>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={valor ? dataDoCalendario(valor) : undefined}
          onSelect={(d) => {
            if (!d) return;
            aoMudar(isoDoCalendario(d));
            setAberto(false);
          }}
          autoFocus
          className="pointer-events-auto p-3"
        />
      </PopoverContent>
    </Popover>
  );
}
