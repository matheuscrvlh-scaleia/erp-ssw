import { cn } from "@/lib/utils";

/** Trilho com a barra proporcional (as linhas de barras são botões; o trilho é só desenho). */
export function Trilho({
  fracao,
  cor = "var(--brand)",
  className,
}: {
  fracao: number;
  cor?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <span aria-hidden className={cn("block h-2 overflow-hidden rounded-full bg-muted", className)}>
      <span
        className="block h-full rounded-full"
        // Barra mínima visível: um item com 1 ao lado de outro com mil não some.
        style={{ width: fracao > 0 ? `max(3px, ${fracao * 100}%)` : 0, background: cor }}
      />
    </span>
  );
}
