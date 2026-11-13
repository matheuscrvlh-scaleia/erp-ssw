import { formatarInteiro, formatarParticipacao } from "@erp/shared/formatting";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

const COR_DA_BARRA = {
  ruim: "bg-status-bad",
  alerta: "bg-status-warn",
  bom: "bg-status-good",
  neutro: "bg-muted-foreground/45",
} as const;

/** Linha de barra horizontal do bloco (clicar recorta a tela). */
export function LinhaDeBarra({
  rotulo,
  valor,
  maximo,
  total,
  apoio,
  ativo,
  tom = "neutro",
  aoClicar,
}: {
  rotulo: ReactNode;
  valor: number;
  maximo: number;
  total?: number;
  apoio?: ReactNode;
  ativo?: boolean;
  tom?: keyof typeof COR_DA_BARRA;
  aoClicar?: () => void;
}) {
  const largura = maximo > 0 ? (valor / maximo) * 100 : 0;
  return (
    <li>
      <button
        type="button"
        onClick={aoClicar}
        disabled={!aoClicar}
        aria-pressed={ativo}
        className={cn(
          "block w-full rounded-lg border px-3 py-2 text-left transition-colors",
          ativo
            ? "border-brand bg-accent text-accent-foreground"
            : aoClicar
              ? "border-transparent hover:bg-muted"
              : "border-transparent",
        )}
      >
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <span className="min-w-0 flex-1 truncate">{rotulo}</span>
          <span className="font-bold tabular-nums">{formatarInteiro(valor)}</span>
          {total !== undefined && (
            <span className="text-xs font-semibold text-muted-foreground tabular-nums">
              {formatarParticipacao(valor, total)}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", COR_DA_BARRA[tom])}
              style={{ width: `${String(largura)}%` }}
            />
          </div>
          {apoio}
        </div>
      </button>
    </li>
  );
}
