import { type Anotacao } from "@erp/shared/contracts/history";
import { diaDaSemana, somarDias } from "@erp/shared/dates";
import { Plus } from "lucide-react";

import { corDoTipo } from "@/components/common/holiday-type";
import { cn } from "@/lib/utils";

import { type DiaDoHistorico } from "../rules";
import { COR_DO_TIPO } from "../texts";

const DIAS_DA_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Calendário do período: semanas inteiras; dia vazio abre anotação nova naquela data. */
export function CalendarioDoPeriodo({
  dias,
  inicio,
  fim,
  hoje,
  editavel,
  aoEditar,
  aoCriar,
}: {
  dias: readonly DiaDoHistorico[];
  inicio: string;
  fim: string;
  hoje: string;
  editavel: (a: Anotacao) => boolean;
  aoEditar: (a: Anotacao) => void;
  aoCriar: (dia: string) => void;
}) {
  const porDia = new Map(dias.map((d) => [d.dia, d]));
  const primeiro = somarDias(inicio, -diaDaSemana(inicio));
  const celulas: string[] = [];
  for (let d = primeiro; d <= fim || diaDaSemana(d) !== 0; d = somarDias(d, 1)) celulas.push(d);
  return (
    <div className="rolagem-fina overflow-x-auto">
      <div className="grid min-w-[700px] grid-cols-7 gap-1.5 text-[12.5px]">
        {DIAS_DA_SEMANA.map((d) => (
          <div key={d} className="label-xs px-1.5 pb-1">
            {d}
          </div>
        ))}
        {celulas.map((dia) => {
          const noPeriodo = dia >= inicio && dia <= fim;
          const d = porDia.get(dia);
          return (
            <div
              key={dia}
              aria-current={dia === hoje ? "date" : undefined}
              className={cn(
                "flex min-h-24 flex-col gap-1 rounded-lg border p-1.5",
                noPeriodo ? "border-border bg-card" : "border-transparent bg-muted/50 opacity-50",
                dia === hoje && "border-brand ring-1 ring-brand",
              )}
            >
              <button
                type="button"
                disabled={!noPeriodo}
                onClick={() => {
                  aoCriar(dia);
                }}
                title="Nova anotação neste dia"
                className="group/novo flex w-full items-center justify-between rounded-md px-1 text-left font-semibold tabular-nums hover:bg-muted hover:text-brand disabled:hover:bg-transparent disabled:hover:text-inherit"
              >
                {dia.slice(8)}/{dia.slice(5, 7)}
                {noPeriodo && (
                  <Plus
                    className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover/novo:opacity-100"
                    aria-hidden
                  />
                )}
              </button>
              {d?.feriados.map((f) => (
                <div
                  key={f.id}
                  title={f.descricao}
                  className={cn("truncate rounded-md border px-1.5 py-0.5", corDoTipo(f.tipo))}
                >
                  {f.descricao}
                </div>
              ))}
              {d?.anotacoes.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={!editavel(a)}
                  onClick={() => {
                    aoEditar(a);
                  }}
                  title={a.texto}
                  className="flex w-full items-center gap-1.5 rounded-md border border-border bg-superficie px-1.5 py-0.5 text-left hover:border-brand/40 disabled:hover:border-border"
                >
                  <span
                    aria-hidden
                    className={cn("h-2 w-2 shrink-0 rounded-full", COR_DO_TIPO[a.tipo].ponto)}
                  />
                  <span className="truncate">{a.texto}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
