import { type Feriado } from "@erp/shared/contracts/calendar";

import { corDoTipo } from "@/components/common/holiday-type";
import { Painel } from "@/components/common/Panel";
import { cn } from "@/lib/utils";

import { montarGradeDoMes } from "../rules";
import { MESES_LONGOS, SEMANA } from "../texts";
import { Legenda } from "./Legend";

export function VisaoAno({
  ano,
  hoje,
  feriadosPorData,
  aoEscolherMes,
}: {
  ano: number;
  hoje: string;
  feriadosPorData: Map<string, Feriado[]>;
  aoEscolherMes: (mes: number) => void;
}) {
  return (
    <Painel titulo={String(ano)} rodape={<Legenda />} classeDoCorpo="p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MESES_LONGOS.map((nomeDoMes, mes) => {
          const grade = montarGradeDoMes(ano, mes);
          return (
            <button
              type="button"
              key={nomeDoMes}
              onClick={() => {
                aoEscolherMes(mes);
              }}
              className="rounded-xl border border-border bg-card p-3 text-left transition-[box-shadow,border-color] hover:border-brand/40 hover:shadow-flutuante"
            >
              <span className="mb-2 block text-[13px] font-semibold">{nomeDoMes}</span>
              <span className="grid grid-cols-7 gap-0.5 text-center text-xs text-muted-foreground">
                {SEMANA.map((s, i) => (
                  <span key={i}>{s}</span>
                ))}
              </span>
              <span className="mt-0.5 grid grid-cols-7 gap-0.5">
                {grade.map((d) => {
                  const [principal] = feriadosPorData.get(d.iso) ?? [];
                  return (
                    <span
                      key={d.iso}
                      title={principal?.descricao ?? ""}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-md border border-transparent text-xs tabular-nums",
                        d.outroMes && "opacity-25",
                        principal && cn(corDoTipo(principal.tipo), "font-semibold"),
                        d.iso === hoje && "ring-1 ring-brand",
                      )}
                    >
                      {d.dia}
                    </span>
                  );
                })}
              </span>
            </button>
          );
        })}
      </div>
    </Painel>
  );
}
