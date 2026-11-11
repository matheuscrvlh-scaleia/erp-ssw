import { Skeleton } from "@/componentes/ui/skeleton";

/** Linhas cinza no corpo de uma `<table>` feita à mão enquanto ela carrega. */
export function LinhasCarregando({ linhas, colunas }: { linhas: number; colunas: number }) {
  return (
    <>
      {Array.from({ length: linhas }, (_, i) => (
        <tr key={i} className="border-b border-border">
          {Array.from({ length: colunas }, (__, j) => (
            <td key={j} className="px-4 py-3">
              <Skeleton className="h-3.5 w-full rounded-md bg-muted" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
