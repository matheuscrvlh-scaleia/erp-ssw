// Faixas de prazo (barra empilhada 100% + chips que abrem a lista).
import { formatarInteiro, formatarPercentual } from "@erp/shared/formatacao";
import { type ReactNode } from "react";

import { InfoTip } from "@/componentes/comum/InfoTip";
import { CLASSE_DO_TOM, ICONE_DO_TOM, type Tom } from "@/componentes/comum/SeloStatus";
import { cn } from "@/lib/utils";

import { ComDica } from "./ComDica";

export type ChaveDaFaixa = "vencida" | "hoje" | "futuro" | "sem_prev";

interface ContagemDasFaixas {
  vencida: number;
  hoje: number;
  futuro: number;
  semPrev: number;
}

const FAIXAS: readonly {
  chave: Exclude<ChaveDaFaixa, "sem_prev">;
  rotulo: string;
  tom: Tom;
  cor: string;
}[] = [
  { chave: "vencida", rotulo: "Vencida", tom: "erro", cor: "var(--status-bad)" },
  { chave: "hoje", rotulo: "Vencendo no dia", tom: "alerta", cor: "var(--status-warn)" },
  { chave: "futuro", rotulo: "Vencimento futuro", tom: "sucesso", cor: "var(--status-good)" },
];

/**
 * Uma linha de faixas de prazo: título, barra empilhada (dica no mouse) e um chip por faixa.
 * Os chips são os botões (teclado); a barra mostra a proporção.
 */
export function FaixasDePrazo({
  rotulo,
  dica,
  faixas,
  aoAbrir,
}: {
  rotulo: ReactNode;
  dica?: string | undefined;
  faixas: ContagemDasFaixas | undefined;
  aoAbrir: (faixa: ChaveDaFaixa) => void;
}) {
  const f = faixas ?? { vencida: 0, hoje: 0, futuro: 0, semPrev: 0 };
  const total = f.vencida + f.hoje + f.futuro + f.semPrev;
  const segmentos = [
    ...FAIXAS.map((x) => ({ chave: x.chave, rotulo: x.rotulo, cor: x.cor, valor: f[x.chave] })),
    {
      chave: "sem_prev",
      rotulo: "Sem prazo definido",
      cor: "var(--muted-foreground)",
      valor: f.semPrev,
    },
  ].filter((s) => s.valor > 0);
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
        <span>{rotulo}</span>
        {dica && <InfoTip texto={dica} />}
      </div>
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
        {total > 0 &&
          segmentos.map((s) => (
            <ComDica
              key={s.chave}
              texto={`${s.rotulo}: ${formatarInteiro(s.valor)} (${formatarPercentual(s.valor / total)})`}
            >
              <span
                className="h-full transition-opacity hover:opacity-80"
                style={{ flexGrow: s.valor, flexBasis: 0, background: s.cor }}
              />
            </ComDica>
          ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {FAIXAS.map((x) => {
          const Icone = ICONE_DO_TOM[x.tom];
          return (
            <button
              key={x.chave}
              type="button"
              onClick={() => {
                aoAbrir(x.chave);
              }}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium transition-[filter] hover:brightness-95",
                CLASSE_DO_TOM[x.tom],
              )}
            >
              <Icone className="h-3.5 w-3.5" aria-hidden />
              {x.rotulo}
              <span className="font-bold tabular-nums">{formatarInteiro(f[x.chave])}</span>
            </button>
          );
        })}
        <button
          type="button"
          className="h-7 rounded-full px-2 text-[12.5px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => {
            aoAbrir("sem_prev");
          }}
        >
          sem prazo definido: {formatarInteiro(f.semPrev)}
        </button>
      </div>
    </div>
  );
}
