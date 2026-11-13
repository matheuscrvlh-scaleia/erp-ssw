import { ChevronDown, type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

/**
 * Item recolhível (o "accordion" da tela atual), com `<details>` nativo: teclado e leitor de
 * tela. Use em lista dentro de um `Painel` (as bordas entre itens vêm do `divide-y` do pai).
 */
export function ItemRecolhivel({
  titulo,
  icone: Icone,
  children,
}: {
  titulo: ReactNode;
  icone?: LucideIcon | undefined;
  children: ReactNode;
}) {
  return (
    <details className="group">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-5 py-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
        {Icone && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-brand">
            <Icone className="h-4 w-4" aria-hidden />
          </span>
        )}
        <span className="min-w-0 flex-1">{titulo}</span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-border bg-background/40 px-5 py-4">{children}</div>
    </details>
  );
}
