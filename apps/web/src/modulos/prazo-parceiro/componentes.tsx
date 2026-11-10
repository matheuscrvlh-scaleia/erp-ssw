/** Peças comuns da visão geral e do detalhe do Prazo do parceiro. Visual da tela de hoje. */
import { ROTULO_ATALHO } from "@/componentes/comum/periodo";
import { cn } from "@/lib/utils";

import { type Periodo, PERIODOS } from "./busca";

export type Tom = "bom" | "alerta" | "ruim" | "neutro";

const COR: Record<Tom, string> = {
  bom: "var(--status-good)",
  alerta: "var(--status-warn)",
  ruim: "var(--status-bad)",
  neutro: "var(--kpi-positive)",
};

/** Meta e alerta do SLA da empresa (frações). */
export interface Sla {
  meta: number;
  alerta: number;
}

export function tomDoSla(p: number, sla: Sla): Tom {
  if (p >= sla.meta) return "bom";
  if (p >= sla.alerta) return "alerta";
  return "ruim";
}

export function classeDoSla(p: number, sla: Sla): string {
  if (p >= sla.meta) return "text-emerald-700";
  if (p >= sla.alerta) return "text-amber-700";
  return "text-[var(--status-bad)]";
}

/** Card grande de performance (barra de 5 px à esquerda + número na cor do tom). */
export function CartaoMetrica({
  rotulo,
  valor,
  dica,
  selo,
  seloDaMarca,
  tom = "neutro",
  carregando,
  destaque,
  tamanho = "grande",
}: {
  rotulo: string;
  valor: string;
  dica?: string;
  selo?: string;
  seloDaMarca?: boolean;
  tom?: Tom | undefined;
  carregando: boolean;
  destaque?: boolean;
  tamanho?: "grande" | "medio";
}) {
  const cor = COR[tom];
  return (
    <div
      style={{ borderLeftColor: cor }}
      className={cn(
        "rounded-[10px] border border-l-[5px] bg-card px-4 py-3",
        destaque ? "border-[var(--brand)]" : "border-border/70",
        destaque && selo && "shadow-[0_0_0_2px_var(--status-good-bg)_inset]",
      )}
    >
      <div className="flex items-center gap-1.5">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{rotulo}</div>
        {selo && (
          <span
            className={cn(
              "rounded-full px-1.5 py-px text-[10px]",
              seloDaMarca
                ? "bg-[var(--status-good-bg)] text-[var(--brand)]"
                : "bg-muted text-muted-foreground",
            )}
          >
            {selo}
          </span>
        )}
      </div>
      {carregando ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded bg-muted/60" />
      ) : (
        <div
          className={cn(
            "mt-1 font-medium tabular-nums leading-tight",
            tamanho === "grande" ? "text-[32px]" : "text-[28px]",
          )}
          style={{ color: cor }}
        >
          {valor}
        </div>
      )}
      {dica && <div className="mt-1 text-[11px] text-muted-foreground">{dica}</div>}
    </div>
  );
}

/** Linhas cinza enquanto a tabela carrega. */
export function LinhasCarregando({ linhas, colunas }: { linhas: number; colunas: number }) {
  return (
    <>
      {Array.from({ length: linhas }, (_, i) => (
        <tr key={i} className="border-b border-border/40">
          {Array.from({ length: colunas }, (__, j) => (
            <td key={j} className="px-3 py-2">
              <div className="h-3 w-full animate-pulse rounded bg-muted/60" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Seletor de período (os atalhos de hoje: Hoje, 7 dias, 30 dias, Mês; sem intervalo livre). */
export function BotoesDePeriodo({
  atual,
  aoMudar,
}: {
  atual: Periodo;
  aoMudar: (p: Periodo) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Período"
      className="flex rounded-md border border-border/70 p-0.5"
    >
      {PERIODOS.map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed={atual === p}
          onClick={() => {
            aoMudar(p);
          }}
          className={cn(
            "rounded-[5px] px-3 py-1 text-[12px] transition-colors",
            atual === p ? "bg-[var(--brand)] text-white" : "text-muted-foreground hover:bg-muted",
          )}
        >
          {ROTULO_ATALHO[p]}
        </button>
      ))}
    </div>
  );
}
