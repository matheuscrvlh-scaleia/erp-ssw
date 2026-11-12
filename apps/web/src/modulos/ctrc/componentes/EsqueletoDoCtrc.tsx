import { Skeleton } from "@/componentes/ui/skeleton";

export function EsqueletoDoCtrc() {
  return (
    <div className="space-y-4" aria-busy>
      <Skeleton className="h-14 w-full rounded-2xl bg-muted" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl bg-muted" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
