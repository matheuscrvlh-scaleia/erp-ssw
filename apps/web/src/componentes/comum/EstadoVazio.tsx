import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface EstadoVazioProps {
  /** Ex.: "Nenhuma coleta encontrada." */
  mensagem: string;
  /** Dica do que fazer (ex.: "Amplie o período ou tire filtros."). */
  detalhe?: string | undefined;
  icone?: LucideIcon | undefined;
  /** Botão ou link de ação. */
  acao?: ReactNode;
  className?: string | undefined;
}

/** Lista, tabela ou gráfico sem dados para os filtros escolhidos. */
export function EstadoVazio({
  mensagem,
  detalhe,
  icone: Icone,
  acao,
  className,
}: EstadoVazioProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-1 px-3 py-6 text-center text-[12px] text-muted-foreground",
        className,
      )}
    >
      {Icone && <Icone className="mb-1 h-5 w-5 opacity-60" aria-hidden />}
      <p>{mensagem}</p>
      {detalhe && <p className="text-[11px]">{detalhe}</p>}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  );
}
