import { BarChart3, Route, Truck } from "lucide-react";
import { type CSSProperties } from "react";

import { paletaDaMarca } from "@/acesso/marca";
import { cn } from "@/lib/utils";

/** Itens de menu da amostra da barra lateral (o primeiro aparece ativo). */
const ITENS_DA_AMOSTRA = [
  { rotulo: "Performance", icone: BarChart3 },
  { rotulo: "Romaneio", icone: Truck },
  { rotulo: "Ocorrências", icone: Route },
] as const;

/**
 * Amostra ao vivo da paleta que a cor principal gera (`paletaDaMarca`, a mesma do painel): barra
 * lateral, botão primário e texto da marca nos dois temas. A amostra escura liga o tema escuro só
 * nela e troca a cor da marca pela digitada, então os tokens do tema resolvem com a cor nova.
 */
export function PreviaDaMarca({ cor, nomeCurto }: { cor: string; nomeCurto: string }) {
  const paleta = paletaDaMarca(cor);
  const de = (nome: string) => paleta[nome] ?? "";
  const temaEscuro: CSSProperties & Record<`--${string}`, string> = {
    "--marca-clara": de("--marca-clara"),
    "--marca-clara-fg": de("--marca-clara-fg"),
  };
  return (
    <section aria-label="Pré-visualização da cor principal" className="space-y-3">
      <div>
        <div className="label-xs">Pré-visualização</div>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          A cor principal muda o painel inteiro da empresa: barra lateral, botões, links, gráficos e
          o tema escuro. O contraste é ajustado sozinho para continuar legível.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
        <div
          className="flex flex-col gap-1 rounded-xl p-2.5 shadow-cartao"
          style={{ backgroundColor: de("--lateral") }}
          aria-label="Barra lateral"
          role="img"
        >
          <div className="mb-2 flex items-center gap-2 px-1.5 pt-1">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold"
              style={{ backgroundColor: de("--lateral-destaque"), color: de("--lateral") }}
            >
              {(nomeCurto.trim() || "FR").slice(0, 2).toUpperCase()}
            </span>
            <span className="text-[13px] font-semibold text-sidebar-accent-foreground">
              {nomeCurto.trim() || "Empresa"}
            </span>
          </div>
          {ITENS_DA_AMOSTRA.map(({ rotulo, icone: Icone }, i) => (
            <span
              key={rotulo}
              className={cn(
                "relative flex h-8 items-center gap-2 rounded-lg px-2 text-[12.5px]",
                i === 0
                  ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                  : "text-sidebar-foreground",
              )}
            >
              <Icone
                className="h-4 w-4"
                aria-hidden
                style={i === 0 ? { color: de("--lateral-destaque") } : undefined}
              />
              {rotulo}
              {i === 0 && (
                <span
                  aria-hidden
                  className="absolute top-1.5 right-0 bottom-1.5 w-[3px] rounded-full"
                  style={{ backgroundColor: de("--lateral-destaque") }}
                />
              )}
            </span>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-border bg-[Canvas] p-4 text-[CanvasText] [color-scheme:light]">
            <div className="label-xs opacity-60">Tema claro</div>
            <p className="text-[15px] font-bold" style={{ color: de("--marca-texto") }}>
              Texto da marca
            </p>
            <span
              className="inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-semibold shadow-cartao"
              style={{ backgroundColor: de("--marca"), color: de("--marca-fg") }}
            >
              Botão primário
            </span>
          </div>
          <div
            className="dark space-y-3 rounded-xl border border-border bg-background p-4 text-foreground"
            style={temaEscuro}
          >
            <div className="label-xs text-muted-foreground">Tema escuro</div>
            <p className="text-[15px] font-bold text-brand">Texto da marca</p>
            <span className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground shadow-cartao">
              Botão primário
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
