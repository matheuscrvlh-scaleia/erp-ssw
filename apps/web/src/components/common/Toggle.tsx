import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface OpcaoDoAlternador<T extends string> {
  valor: T;
  rotulo: ReactNode;
  /** Dica (title) da opção. */
  dica?: string | undefined;
}

/**
 * Alternador segmentado (2–5 opções mutuamente exclusivas: visão, base de data, agrupamento).
 * Mesmo desenho do seletor de período. Para trocar de CONTEÚDO da tela, use `Abas`.
 */
export function Alternador<T extends string>({
  opcoes,
  valor,
  aoMudar,
  rotulo,
  tamanho = "normal",
  className,
}: {
  opcoes: readonly OpcaoDoAlternador<T>[];
  valor: T;
  aoMudar: (valor: T) => void;
  /** Nome do grupo para o leitor de tela. */
  rotulo: string;
  tamanho?: "normal" | "pequeno";
  className?: string | undefined;
}) {
  return (
    <div
      role="group"
      aria-label={rotulo}
      className={cn(
        "inline-flex items-center rounded-lg border border-border bg-card p-0.5 shadow-cartao",
        tamanho === "pequeno" ? "h-8" : "h-9",
        className,
      )}
    >
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={valor === o.valor}
          title={o.dica}
          onClick={() => {
            aoMudar(o.valor);
          }}
          className={cn(
            "inline-flex h-full items-center gap-1.5 rounded-md px-3 font-medium whitespace-nowrap transition-colors",
            tamanho === "pequeno" ? "text-[12.5px]" : "text-[13px]",
            valor === o.valor
              ? "bg-primary text-primary-foreground shadow-cartao"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}
