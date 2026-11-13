import { type OcorrenciaDoCtrc } from "@erp/shared/contracts/ctrc";
import { formatarDataHora } from "@erp/shared/formatting";
import { AlertTriangle, Clock, History } from "lucide-react";

import { EstadoVazio } from "@/components/common/EmptyState";
import { SeloStatus } from "@/components/common/StatusBadge";
import { cn } from "@/lib/utils";

import { Etiqueta } from "./Tag";

/** Ocorrências na ordem recebida, ligadas por um trilho; as que penalizam em destaque. */
export function LinhaDoTempo({
  ocorrencias,
  fuso,
}: {
  ocorrencias: readonly OcorrenciaDoCtrc[];
  fuso: string;
}) {
  if (ocorrencias.length === 0) {
    return (
      <EstadoVazio className="py-6" icone={History} mensagem="Nenhuma ocorrência registrada." />
    );
  }
  return (
    <ol>
      {ocorrencias.map((o, i) => (
        <li key={o.id} className="relative flex gap-3 pb-5 last:pb-0">
          {i < ocorrencias.length - 1 && (
            <span
              aria-hidden
              className="absolute top-9 bottom-1 left-[15px] w-0.5 rounded-full bg-muted-foreground/35"
            />
          )}
          <span
            aria-hidden
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
              o.penaliza
                ? "border-status-bad/40 bg-status-bad-bg text-status-bad-fg"
                : "border-border bg-superficie text-muted-foreground",
            )}
          >
            {o.penaliza ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <div className="text-[13px] font-semibold text-foreground">{o.descricao ?? "—"}</div>
            <time
              dateTime={o.dataHora}
              className="mt-0.5 block text-[12.5px] text-muted-foreground tabular-nums"
            >
              {formatarDataHora(o.dataHora, fuso)}
            </time>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                #{o.codigo}
              </span>
              {o.penaliza && <SeloStatus tom="erro">penaliza</SeloStatus>}
              {o.responsavel && <Etiqueta>{o.responsavel}</Etiqueta>}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
