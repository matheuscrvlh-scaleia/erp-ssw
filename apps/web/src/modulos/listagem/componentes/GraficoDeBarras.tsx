import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { Painel } from "@/componentes/comum/Painel";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/componentes/ui/tooltip";
import { cn } from "@/lib/utils";

export interface Barra {
  chave: string;
  rotulo: string;
  qtd: number;
  /** Texto da dica (ex.: "#35 — Agendamento"). */
  dica: string;
  ativa: boolean;
}

/**
 * Barras horizontais clicáveis, com a barra do filtro ativo em destaque (o clique filtra a lista).
 * Fica fora do `GraficoBarras` do kit: aquele é vertical e não marca a barra ativa.
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
  const algumaAtiva = barras.some((b) => b.ativa);
  return (
    <Painel titulo={titulo} descricao={subtitulo} classeDoCorpo="px-3 py-3">
      {barras.length === 0 ? (
        <EstadoVazio
          mensagem={vazio}
          detalhe="Amplie o período ou tire algum filtro."
          className="min-h-[180px] py-6"
        />
      ) : (
        <TooltipProvider delayDuration={100}>
          <ul className="space-y-0.5" aria-label={titulo}>
            {barras.map((b) => {
              const texto = `${b.dica}: ${b.qtd.toLocaleString("pt-BR")} CTRCs`;
              return (
                <li key={b.chave}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => {
                          aoClicar(b.chave);
                        }}
                        aria-label={texto}
                        aria-pressed={b.ativa}
                        className={cn(
                          "group flex h-7 w-full items-center gap-2 rounded-md px-1.5 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
                          b.ativa && "bg-accent",
                        )}
                      >
                        <span
                          className={cn(
                            "shrink-0 truncate text-right",
                            b.ativa ? "font-semibold text-foreground" : "text-muted-foreground",
                          )}
                          style={{ width: larguraDoRotulo }}
                        >
                          {b.rotulo}
                        </span>
                        <span className="flex h-4 min-w-0 flex-1 items-center gap-1.5">
                          <span
                            className={cn(
                              "h-full rounded-[4px] transition-[opacity,background-color]",
                              b.ativa
                                ? "bg-brand"
                                : algumaAtiva
                                  ? "bg-brand/25 group-hover:bg-brand/45"
                                  : "bg-brand/70 group-hover:bg-brand",
                            )}
                            style={{ width: `${String(Math.max(2, (b.qtd / maior) * 100))}%` }}
                          />
                          <span className="shrink-0 font-semibold text-foreground tabular-nums">
                            {b.qtd.toLocaleString("pt-BR")}
                          </span>
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-[12px]">
                      {texto}
                      <span className="block opacity-75">
                        {b.ativa ? "Clique para tirar o filtro" : "Clique para filtrar a lista"}
                      </span>
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </TooltipProvider>
      )}
    </Painel>
  );
}
