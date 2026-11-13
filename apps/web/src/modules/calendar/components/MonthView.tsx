import { unidadesImpactadas } from "@erp/domain/calendar";
import { type Feriado, type UnidadeDoCalendario } from "@erp/shared/contracts/calendar";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { corDoTipo } from "@/components/common/holiday-type";
import { Painel } from "@/components/common/Panel";
import { EtiquetaDoTipo } from "@/components/common/TypeTag";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { montarGradeDoMes } from "../rules";
import { formatarDiaCurto, localDo, MESES_LONGOS, nomesDasUnidades, SEMANA } from "../texts";
import { Legenda } from "./Legend";

export function VisaoMes({
  ano,
  mes,
  hoje,
  aoMudarMes,
  feriadosPorData,
  unidades,
}: {
  ano: number;
  mes: number;
  hoje: string;
  aoMudarMes: (mes: number) => void;
  feriadosPorData: Map<string, Feriado[]>;
  unidades: UnidadeDoCalendario[];
}) {
  return (
    <Painel
      titulo={`${MESES_LONGOS[mes] ?? ""} ${String(ano)}`}
      acoes={
        <>
          <Button
            size="sm"
            variant="outline"
            className="w-8 px-0"
            aria-label="Mês anterior"
            title="Mês anterior"
            onClick={() => {
              aoMudarMes((mes + 11) % 12);
            }}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-8 px-0"
            aria-label="Próximo mês"
            title="Próximo mês"
            onClick={() => {
              aoMudarMes((mes + 1) % 12);
            }}
          >
            <ChevronRight aria-hidden />
          </Button>
        </>
      }
      rodape={<Legenda />}
      classeDoCorpo="p-3 sm:p-4"
    >
      <div className="grid grid-cols-7 gap-1 pb-1.5 text-center sm:gap-1.5">
        {SEMANA.map((s, i) => (
          <div key={i} className="label-xs">
            {s}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {montarGradeDoMes(ano, mes).map((d) => (
          <Dia
            key={d.iso}
            iso={d.iso}
            dia={d.dia}
            outroMes={d.outroMes}
            ehHoje={d.iso === hoje}
            feriados={feriadosPorData.get(d.iso) ?? []}
            unidades={unidades}
          />
        ))}
      </div>
    </Painel>
  );
}

const CELULA = "flex min-h-14 flex-col rounded-lg border p-1.5 text-left text-[13px] sm:min-h-20";

function Dia({
  iso,
  dia,
  outroMes,
  ehHoje,
  feriados,
  unidades,
}: {
  iso: string;
  dia: number;
  outroMes: boolean;
  ehHoje: boolean;
  feriados: Feriado[];
  unidades: UnidadeDoCalendario[];
}) {
  const [principal] = feriados;
  const numero = (
    <span
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-full tabular-nums",
        ehHoje && "bg-primary font-bold text-primary-foreground",
      )}
    >
      {dia}
    </span>
  );
  if (!principal) {
    return (
      <div
        aria-current={ehHoje ? "date" : undefined}
        className={cn(CELULA, "border-border bg-card text-foreground", outroMes && "opacity-35")}
      >
        {numero}
      </div>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-current={ehHoje ? "date" : undefined}
          aria-label={`${formatarDiaCurto(iso)}: ${feriados.map((f) => f.descricao).join(", ")}`}
          className={cn(
            CELULA,
            "transition-shadow hover:shadow-flutuante",
            corDoTipo(principal.tipo),
            outroMes && "opacity-50",
          )}
        >
          <span className="font-semibold">{numero}</span>
          <span className="mt-auto hidden truncate text-xs leading-snug sm:block">
            {principal.descricao}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-[13px]">
        <p className="font-semibold">{formatarDiaCurto(iso)}</p>
        <div className="mt-2 space-y-2">
          {feriados.map((f) => (
            <div key={f.id} className="rounded-lg border border-border p-2.5">
              <div className="flex items-center gap-2">
                <EtiquetaDoTipo tipo={f.tipo} />
                <span className="font-semibold">{f.descricao}</span>
              </div>
              {(f.cidade ?? f.uf) && <p className="mt-1 text-muted-foreground">{localDo(f)}</p>}
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Impacta {nomesDasUnidades(unidadesImpactadas(f, unidades))}
              </p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
