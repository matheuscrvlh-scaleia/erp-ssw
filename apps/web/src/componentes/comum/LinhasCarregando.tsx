import { Skeleton } from "@/componentes/ui/skeleton";

/** Linhas cinza no corpo de uma `<table>` feita à mão enquanto ela carrega. */
export function LinhasCarregando({ linhas, colunas }: { linhas: number; colunas: number }) {
  return (
    <>
      {Array.from({ length: linhas }, (_, i) => (
        <tr key={i} className="border-b border-border/40">
          {Array.from({ length: colunas }, (__, j) => (
            <td key={j} className="px-3 py-2">
              <Skeleton className="h-3 w-full rounded bg-muted/60" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
