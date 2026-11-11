import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { CLASSE_DO_TOM, ICONE_DO_TOM, type Tom } from "./SeloStatus";

/**
 * Faixa de aviso dentro da tela (alerta, erro, informação, sucesso): ícone, título, texto e ação
 * à direita. Substitui as caixas âmbar/vermelhas montadas à mão em cada tela.
 */
export function Aviso({
  tom,
  titulo,
  icone,
  acao,
  className,
  children,
}: {
  tom: Exclude<Tom, "neutro">;
  titulo?: ReactNode;
  icone?: LucideIcon | undefined;
  /** Botão ou link à direita (ex.: "Abrir configuração"). */
  acao?: ReactNode;
  className?: string | undefined;
  children?: ReactNode;
}) {
  const Icone = icone ?? ICONE_DO_TOM[tom];
  return (
    <div
      role={tom === "erro" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl border px-4 py-3 text-[13px]",
        CLASSE_DO_TOM[tom],
        className,
      )}
    >
      <Icone className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className={cn(titulo && "mt-0.5", "opacity-90")}>{children}</div>}
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </div>
  );
}
