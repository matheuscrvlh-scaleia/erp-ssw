import { CalendarDays } from "lucide-react";

/** De / Até num controle só, no desenho dos outros filtros da barra. */
export function FiltroDePeriodo({
  de,
  ate,
  aoMudar,
}: {
  de: string;
  ate: string;
  aoMudar: (parte: { de?: string; ate?: string }) => void;
}) {
  const data =
    "h-full rounded-md bg-transparent px-1.5 text-[13px] tabular-nums outline-none focus-visible:bg-muted";
  return (
    <div
      role="group"
      aria-label="Período"
      className="flex h-9 items-center gap-1 rounded-lg border border-border bg-card pr-1 pl-3 text-[13px] shadow-cartao"
    >
      <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <input
        type="date"
        aria-label="De"
        className={data}
        value={de}
        onChange={(e) => {
          aoMudar({ de: e.target.value });
        }}
      />
      <span className="text-muted-foreground">a</span>
      <input
        type="date"
        aria-label="Até"
        className={data}
        value={ate}
        onChange={(e) => {
          aoMudar({ ate: e.target.value });
        }}
      />
    </div>
  );
}
