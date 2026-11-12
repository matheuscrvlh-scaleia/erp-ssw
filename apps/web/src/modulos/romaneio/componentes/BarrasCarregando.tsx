import { Skeleton } from "@/componentes/ui/skeleton";

/** Lista de barras horizontais carregando (mesma altura das linhas). */
export function BarrasCarregando() {
  return (
    <div className="space-y-3 py-1" aria-hidden>
      {[92, 70, 54, 38, 20].map((w) => (
        <Skeleton key={w} className="h-5 rounded-md bg-muted" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}
