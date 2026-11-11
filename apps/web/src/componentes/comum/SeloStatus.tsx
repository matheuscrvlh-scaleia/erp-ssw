import {
  AlertTriangle,
  CircleCheck,
  CircleDashed,
  CircleX,
  Info,
  type LucideIcon,
} from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Situação genérica para selos e faixas. Sempre com ícone + texto, nunca só a cor. */
export type Tom = "sucesso" | "alerta" | "erro" | "info" | "neutro";

export const CLASSE_DO_TOM: Record<Tom, string> = {
  sucesso: "border-status-good/30 bg-status-good-bg text-status-good-fg",
  alerta: "border-status-warn/35 bg-status-warn-bg text-status-warn-fg",
  erro: "border-status-bad/30 bg-status-bad-bg text-status-bad-fg",
  info: "border-status-info/30 bg-status-info-bg text-status-info-fg",
  neutro: "border-border bg-muted text-muted-foreground",
};

export const ICONE_DO_TOM: Record<Tom, LucideIcon> = {
  sucesso: CircleCheck,
  alerta: AlertTriangle,
  erro: CircleX,
  info: Info,
  neutro: CircleDashed,
};

/**
 * Selo de situação em pílula (status de linha, de integração, de cadastro).
 * Ex.: `<SeloStatus tom="sucesso">Ativo</SeloStatus>`.
 */
export function SeloStatus({
  tom,
  icone,
  semIcone,
  className,
  children,
}: {
  tom: Tom;
  /** Troca o ícone padrão do tom. */
  icone?: LucideIcon | undefined;
  semIcone?: boolean | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  const Icone = icone ?? ICONE_DO_TOM[tom];
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1 rounded-full border px-2 text-[12px] font-semibold whitespace-nowrap",
        CLASSE_DO_TOM[tom],
        className,
      )}
    >
      {!semIcone && <Icone className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      <span className="truncate">{children}</span>
    </span>
  );
}
