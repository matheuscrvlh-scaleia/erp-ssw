import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EstadoVazioProps {
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
        "flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center text-[13px] text-muted-foreground",
        className,
      )}
    >
      {Icone && (
        <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Icone className="h-5 w-5" aria-hidden />
        </span>
      )}
      <p className="font-semibold text-foreground">{mensagem}</p>
      {detalhe && <p className="text-[12.5px]">{detalhe}</p>}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  );
}
