import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Lugar dos cartões enquanto o resumo carrega (mesma grade, a tela não pula). */
export function EsqueletoDeCards({ quantos }: { quantos: number }) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2",
        quantos === 5 ? "xl:grid-cols-5" : "lg:grid-cols-4",
      )}
    >
      {Array.from({ length: quantos }, (_, i) => (
        <Skeleton key={i} className="h-[150px] rounded-2xl border border-border bg-muted" />
      ))}
    </div>
  );
}
