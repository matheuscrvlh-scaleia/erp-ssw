import { cn } from "@/lib/utils";

export interface Barra {
  chave: string;
  rotulo: string;
  qtd: number;
  /** Texto do title (ex.: "#35 — Agendamento"). */
  dica: string;
  ativa: boolean;
}

/**
 * Barras horizontais clicáveis (o clique filtra a lista).
 * TODO(kit-ui): trocar pelo gráfico de barras de `@/componentes/comum/Graficos`.
 * origem: ChartCard + BarChart vertical (performance.lista.tsx, sistema atual)
 */
export function GraficoDeBarras({
  titulo,
  subtitulo,
  vazio,
  barras,
  larguraDoRotulo,
  aoClicar,
}: {
  titulo: string;
  subtitulo: string;
  vazio: string;
  barras: readonly Barra[];
  larguraDoRotulo: number;
  aoClicar: (chave: string) => void;
}) {
  const maior = Math.max(1, ...barras.map((b) => b.qtd));
  return (
    <div className="rounded-lg border border-border/70 bg-card p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="text-[12px] font-medium">{titulo}</div>
        <div className="text-[10px] text-muted-foreground">{subtitulo}</div>
      </div>
      <div style={{ minHeight: Math.max(160, barras.length * 22 + 16) }} className="py-1">
        {barras.length === 0 ? (
          <div className="flex h-[160px] items-center justify-center text-[11px] text-muted-foreground">
            {vazio}
          </div>
        ) : (
          <ul className="space-y-1">
            {barras.map((b) => (
              <li key={b.chave}>
                <button
                  type="button"
                  onClick={() => {
                    aoClicar(b.chave);
                  }}
                  title={`${b.dica}: ${b.qtd.toLocaleString("pt-BR")} CTRCs`}
                  aria-pressed={b.ativa}
                  className="group flex h-[18px] w-full items-center gap-2 text-left text-[10px]"
                >
                  <span
                    className="shrink-0 truncate text-right text-muted-foreground"
                    style={{ width: larguraDoRotulo }}
                  >
                    {b.rotulo}
                  </span>
                  <span className="flex h-full flex-1 items-center">
                    <span
                      className={cn(
                        "h-full rounded-r-sm transition-opacity group-hover:opacity-80",
                        b.ativa ? "bg-brand" : "bg-brand/35",
                      )}
                      style={{ width: `${Math.max(2, (b.qtd / maior) * 100)}%` }}
                    />
                    <span className="ml-1 text-muted-foreground tabular-nums">
                      {b.qtd.toLocaleString("pt-BR")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
