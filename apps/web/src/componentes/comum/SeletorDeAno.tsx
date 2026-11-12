import { ChevronLeft, ChevronRight } from "lucide-react";

const SETA =
  "inline-flex h-full w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

/**
 * Ano dos feriados na barra de filtros (setas + campo), igual no Calendário e em Histórico ›
 * Feriados. Campo vazio ou inválido volta para `anoAtual`.
 */
export function SeletorDeAno({
  ano,
  anoAtual,
  aoMudar,
}: {
  ano: number;
  anoAtual: number;
  aoMudar: (ano: number) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Ano"
      className="inline-flex h-9 items-center rounded-lg border border-border bg-card p-0.5 text-[13px] shadow-cartao"
    >
      <button
        type="button"
        aria-label="Ano anterior"
        title="Ano anterior"
        onClick={() => {
          aoMudar(ano - 1);
        }}
        className={SETA}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <label className="flex h-full items-center gap-1.5 px-1.5">
        <span className="font-medium text-muted-foreground">Ano</span>
        <input
          type="number"
          value={ano}
          onChange={(e) => {
            aoMudar(Number(e.target.value) || anoAtual);
          }}
          className="w-12 [appearance:textfield] bg-transparent text-center font-semibold text-foreground tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </label>
      <button
        type="button"
        aria-label="Próximo ano"
        title="Próximo ano"
        onClick={() => {
          aoMudar(ano + 1);
        }}
        className={SETA}
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
