import { type CalculoDaEquipe } from "@erp/shared/contratos/ranking";
import { formatarMoeda } from "@erp/shared/formatacao";
import { ChevronDown, ChevronUp, Medal, Trophy } from "lucide-react";
import { useState } from "react";

/**
 * "Meu ranking": valor da equipe, posição, números do período e como o valor foi calculado.
 * origem: EquipeMobileView.tsx (sistema atual)
 */
export function EquipeMobileView({
  equipeNome,
  periodoRotulo,
  calculo,
  posicao,
  totalEquipes,
  top3,
}: {
  equipeNome: string;
  periodoRotulo: string;
  calculo: CalculoDaEquipe;
  posicao: number | null;
  totalEquipes: number;
  top3: { posicao: number; nome: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-6">
      <header className="space-y-1">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{equipeNome}</div>
        <div className="text-sm text-muted-foreground">{periodoRotulo}</div>
      </header>

      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-emerald-700/5 p-6 text-center">
        <div className="text-xs uppercase tracking-wider text-emerald-300/80">Você já tem</div>
        <div className="mt-2 text-5xl font-bold text-emerald-300">
          {formatarMoeda(calculo.valorCalculado)}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">estimativa parcial</div>
      </div>

      {posicao !== null && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm">
            <Trophy className="h-4 w-4 text-amber-400" />
            <span className="font-medium">
              {posicao}º lugar entre {totalEquipes} equipes
            </span>
          </div>
          {top3.length > 0 && (
            <div className="mt-3 space-y-1">
              {top3.map((t) => (
                <div key={t.posicao} className="flex items-center gap-2 text-sm">
                  <Medal
                    className={`h-4 w-4 ${
                      t.posicao === 1
                        ? "text-amber-400"
                        : t.posicao === 2
                          ? "text-slate-300"
                          : "text-orange-400"
                    }`}
                  />
                  <span className="text-muted-foreground">{t.posicao}º</span>
                  <span>{t.nome}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Numero rotulo="Entregas" valor={String(calculo.totalEntregas)} />
        <Numero rotulo="No prazo" valor={String(calculo.entregasNoPrazo)} />
        <Numero rotulo="Performance" valor={`${Math.round(calculo.performance * 100)}%`} />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
          onClick={() => { setAberto((v) => !v); }}
        >
          Como esse valor é calculado
          {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {aberto && (
          <div className="space-y-2 border-t border-border px-4 py-3 text-sm">
            {calculo.breakdown.length === 0 ? (
              <div className="text-muted-foreground">Nenhum critério configurado.</div>
            ) : (
              calculo.breakdown.map((b, i) => (
                <div key={i} className="flex justify-between gap-3">
                  <div>
                    <div className="font-medium">{b.label}</div>
                    <div className="text-xs text-muted-foreground">{b.detalhe}</div>
                  </div>
                  <div className={b.subtotal < 0 ? "text-rose-400" : "text-emerald-400"}>
                    {b.subtotal >= 0 ? "+" : ""}
                    {formatarMoeda(b.subtotal)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
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
    <div className="rounded-lg border border-border bg-card p-3 text-center">
      <div className="text-xs text-muted-foreground">{rotulo}</div>
      <div className="mt-1 text-lg font-semibold">{valor}</div>
    </div>
  );
}
