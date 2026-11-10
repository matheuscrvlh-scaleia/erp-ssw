import { cn } from "@/lib/utils";

/** Situação do indicador frente à meta. */
export type StatusKpi = "bom" | "alerta" | "ruim";

/** Barra de 5 px à esquerda + número na cor de acento (paleta --kpi-*). */
const ACENTO: Record<StatusKpi | "neutro", string> = {
  bom: "border-l-kpi-positive text-kpi-positive",
  alerta: "border-l-kpi-alert text-kpi-alert",
  ruim: "border-l-kpi-volume text-kpi-volume",
  neutro: "border-l-kpi-volume text-kpi-volume",
};

const COR_STATUS: Record<StatusKpi, { cor: string; fundo: string; texto: string }> = {
  bom: {
    cor: "var(--status-good)",
    fundo: "var(--status-good-bg)",
    texto: "var(--status-good-fg)",
  },
  alerta: {
    cor: "var(--status-warn)",
    fundo: "var(--status-warn-bg)",
    texto: "var(--status-warn-fg)",
  },
  ruim: { cor: "var(--status-bad)", fundo: "var(--status-bad-bg)", texto: "var(--status-bad-fg)" },
};

/** `>= meta` bom; até 3 pontos abaixo, alerta; abaixo disso, ruim. origem: statusOf */
export function statusDaMeta(valor: number, meta: number, tolerancia = 0.03): StatusKpi {
  if (valor >= meta) return "bom";
  if (valor >= meta - tolerancia) return "alerta";
  return "ruim";
}

export interface KpiCardProps {
  rotulo: string;
  /** Já formatado ("95,1%", "1.234"). */
  valor: string;
  status: StatusKpi;
  /** Linha de apoio sob o número (meta, comparação). */
  detalhe: string;
  /** Etiqueta no canto (ex.: "abaixo da meta"). */
  selo?: string | undefined;
  /** Barra de progresso, fração 0–1. */
  progresso?: number | undefined;
  /** Indicador sem semântica de bom/ruim (volume): sempre na cor de volume. */
  neutro?: boolean | undefined;
  /** Torna o card um botão (ex.: filtrar a lista abaixo). */
  aoClicar?: (() => void) | undefined;
  /** Destaca o card como filtro ativo. */
  ativo?: boolean | undefined;
}

/** Card de indicador. origem: components/common/KpiCard.tsx (sistema atual) */
export function KpiCard({
  rotulo,
  valor,
  status,
  detalhe,
  selo,
  progresso,
  neutro,
  aoClicar,
  ativo,
}: KpiCardProps) {
  const classe = cn(
    "rounded-[10px] border border-border/70 border-l-[5px] bg-card p-5",
    ACENTO[neutro ? "neutro" : status],
    aoClicar &&
      "w-full cursor-pointer text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]",
    ativo && "ring-2 ring-[var(--brand)]",
  );
  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="label-xs font-bold text-foreground">{rotulo}</span>
        {selo && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
            style={{ background: COR_STATUS[status].fundo, color: COR_STATUS[status].texto }}
          >
            {selo}
          </span>
        )}
      </div>
      <div className="num-hero mt-3 font-bold tracking-normal">{valor}</div>
      {progresso != null && (
        <div
          className="mt-3 h-[5px] overflow-hidden rounded-full bg-border/60"
          role="progressbar"
          aria-label={rotulo}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(Math.min(1, Math.max(0, progresso)) * 100)}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.max(2, Math.min(100, progresso * 100))}%`,
              backgroundColor: COR_STATUS[status].cor,
            }}
          />
        </div>
      )}
      <div className="mt-2 text-[11px] text-muted-foreground">{detalhe}</div>
    </>
  );
  return aoClicar ? (
    <button type="button" onClick={aoClicar} aria-pressed={!!ativo} className={classe}>
      {conteudo}
    </button>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}
