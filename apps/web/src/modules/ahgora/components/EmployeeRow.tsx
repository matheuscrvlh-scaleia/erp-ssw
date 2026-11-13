import { type FuncionarioApurado } from "@erp/shared/contracts/ahgora";
import { formatarDiaMes } from "@erp/shared/formatting";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { type KeyboardEvent, useState } from "react";

import { SeloStatus } from "@/components/common/StatusBadge";
import { CLASSE_LINHA, CLASSE_TD } from "@/components/common/table-classes";
import { cn } from "@/lib/utils";

import { formatarHoras, MOTIVO_LABEL } from "../texts";

const TH_DO_DIA = "py-1.5 pr-3 label-xs";

/** Linha do colaborador na apuração; clicar abre as batidas e as horas de cada dia. */
export function LinhaDoFuncionario({ f }: { f: FuncionarioApurado }) {
  const [aberto, setAberto] = useState(false);
  const alternar = () => {
    setAberto((v) => !v);
  };
  const tecla = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    alternar();
  };
  return (
    <>
      <tr
        tabIndex={0}
        className={cn(
          CLASSE_LINHA,
          "cursor-pointer focus-visible:bg-accent focus-visible:outline-none",
          aberto && "bg-muted/40",
        )}
        onClick={alternar}
        onKeyDown={tecla}
        aria-expanded={aberto}
      >
        <td className={CLASSE_TD}>
          <div className="flex items-center gap-1.5">
            {aberto ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
            )}
            <span className="font-semibold">{f.name}</span>
            {f.demitido && <SeloStatus tom="erro">demitido</SeloStatus>}
          </div>
        </td>
        <td className={cn(CLASSE_TD, "font-mono text-xs text-muted-foreground")}>{f.register}</td>
        <td className={cn(CLASSE_TD, "text-muted-foreground")}>{f.department || "—"}</td>
        <td className={cn(CLASSE_TD, "text-right")}>{f.diasComRegistro}</td>
        <td className={cn(CLASSE_TD, "text-right")}>{formatarHoras(f.minutosApurados)}</td>
        <td className={cn(CLASSE_TD, "text-right")}>
          {f.diasARevisar > 0 ? (
            <SeloStatus tom="alerta">{f.diasARevisar}</SeloStatus>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      </tr>

      {aberto && (
        <tr className="border-b border-border">
          <td colSpan={6} className="bg-superficie px-4 py-2">
            {f.dias.length === 0 ? (
              <p className="py-1 text-xs text-muted-foreground">
                Nenhuma batida registrada no período.
              </p>
            ) : (
              <table className="w-full text-[12.5px] tabular-nums">
                <thead>
                  <tr className="text-left">
                    <th className={TH_DO_DIA}>Dia</th>
                    <th className={TH_DO_DIA}>Batidas</th>
                    <th className={cn(TH_DO_DIA, "pr-0 text-right")}>Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {f.dias.map((d) => (
                    <tr key={d.data} className="border-t border-border">
                      <td className="py-1.5 pr-3 align-top">{formatarDiaMes(d.data)}</td>
                      <td className="py-1.5 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {d.batidas.map((b, i) => (
                            <span
                              key={`${b.hora}-${i}`}
                              className={cn(
                                "rounded-md border px-1.5 font-mono",
                                b.tipo === "DELETADA"
                                  ? "border-status-bad/30 text-status-bad-fg line-through"
                                  : "border-border bg-card",
                              )}
                              title={b.tipo}
                            >
                              {b.hora}
                            </span>
                          ))}
                        </div>
                        {d.motivoRevisao && (
                          <p className="mt-1 flex items-start gap-1 text-xs text-status-warn-fg">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                            {MOTIVO_LABEL[d.motivoRevisao]}
                          </p>
                        )}
                      </td>
                      <td className="py-1.5 text-right align-top">
                        {d.minutosTrabalhados === null ? (
                          <span className="font-semibold text-status-warn-fg">revisar</span>
                        ) : (
                          formatarHoras(d.minutosTrabalhados)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
