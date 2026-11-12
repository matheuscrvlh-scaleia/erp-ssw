import { type CalculoDaEquipe } from "@erp/shared/contratos/ranking";
import { formatarMoeda } from "@erp/shared/formatacao";
import { ChevronDown, Medal, Trophy } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

// Ouro, prata e bronze: cores de categoria, não de situação.
const COR_DA_MEDALHA: Record<number, string> = {
  1: "text-serie-4",
  2: "text-muted-foreground",
  3: "text-serie-2",
};

/**
 * "Meu ranking": valor da equipe, posição, números do período e como o valor foi calculado.
 * O cabeçalho (nome da equipe e período) é de quem usa: a página logada e o link público.
 * origem: EquipeMobileView.tsx (sistema atual)
 */
export function ResumoDaEquipe({
  calculo,
  posicao,
  totalEquipes,
  top3,
}: {
  calculo: CalculoDaEquipe;
  posicao: number | null;
  totalEquipes: number;
  top3: { posicao: number; nome: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <div className="rounded-2xl border border-brand/30 bg-brand-suave p-1 shadow-cartao">
        <div className="rounded-xl border border-border bg-card px-6 py-7 text-center">
          <div className="label-xs">Você já tem</div>
          <div className="mt-2 text-5xl font-bold tracking-tight text-brand tabular-nums">
            {formatarMoeda(calculo.valorCalculado)}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">estimativa parcial</div>
        </div>
      </div>

      {posicao !== null && (
        <div className="rounded-2xl border border-border bg-superficie p-1 shadow-cartao">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-[15px] font-bold">
              <Trophy className="h-5 w-5 text-serie-4" aria-hidden />
              <span>
                {posicao}º lugar entre {totalEquipes} equipes
              </span>
            </div>
            {top3.length > 0 && (
              <ol className="mt-3 divide-y divide-border">
                {top3.map((t) => (
                  <li
                    key={t.posicao}
                    className={cn(
                      "flex items-center gap-2 py-2 text-[13px]",
                      t.posicao === posicao && "font-semibold",
                    )}
                  >
                    <Medal
                      className={cn(
                        "h-4 w-4",
                        COR_DA_MEDALHA[t.posicao] ?? "text-muted-foreground",
                      )}
                      aria-hidden
                    />
                    <span className="w-6 text-muted-foreground tabular-nums">{t.posicao}º</span>
                    <span>{t.nome}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Numero rotulo="Entregas" valor={String(calculo.totalEntregas)} />
        <Numero rotulo="No prazo" valor={String(calculo.entregasNoPrazo)} />
        <Numero rotulo="Performance" valor={`${Math.round(calculo.performance * 100)}%`} />
      </div>

      <div className="rounded-2xl border border-border bg-superficie p-1 shadow-cartao">
        <div className="rounded-xl border border-border bg-card">
          <button
            type="button"
            aria-expanded={aberto}
            className="flex min-h-11 w-full items-center justify-between rounded-xl px-4 py-3 text-[13px] font-semibold hover:bg-muted"
            onClick={() => {
              setAberto((v) => !v);
            }}
          >
            Como esse valor é calculado
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", aberto && "rotate-180")}
              aria-hidden
            />
          </button>
          {aberto && (
            <div className="space-y-3 border-t border-border px-4 py-3 text-[13px]">
              {calculo.breakdown.length === 0 ? (
                <div className="text-muted-foreground">Nenhum critério configurado.</div>
              ) : (
                calculo.breakdown.map((b, i) => (
                  <div key={i} className="flex justify-between gap-3">
                    <div>
                      <div className="font-semibold">{b.label}</div>
                      <div className="text-xs text-muted-foreground">{b.detalhe}</div>
                    </div>
                    <div
                      className={cn(
                        "font-semibold whitespace-nowrap tabular-nums",
                        b.subtotal < 0 ? "text-status-bad-fg" : "text-status-good-fg",
                      )}
                    >
                      {b.subtotal >= 0 ? "+" : ""}
                      {formatarMoeda(b.subtotal)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {calculo.penalizantes > 0 && (
        <div className="text-center text-xs text-muted-foreground">
          {calculo.penalizantes} ocorrência(s) penalizante(s) no período
        </div>
      )}
    </div>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-border bg-superficie p-1 shadow-cartao">
      <div className="rounded-xl border border-border bg-card px-2 py-3 text-center">
        <div className="text-xs text-muted-foreground">{rotulo}</div>
        <div className="mt-1 text-[18px] font-bold tabular-nums">{valor}</div>
      </div>
    </div>
  );
}
