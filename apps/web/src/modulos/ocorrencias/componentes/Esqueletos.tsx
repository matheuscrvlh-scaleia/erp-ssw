import { Skeleton } from "@/componentes/ui/skeleton";

/** Linhas de carregando do bloco. */
export function Esqueletos({ n = 5 }: { n?: number }) {
  return Array.from({ length: n }, (_, i) => (
    <li key={i}>
      <Skeleton className="h-11 rounded-lg bg-muted" />
    </li>
  ));
}
