import { AlertTriangle, ArrowRight, CircleCheck, CircleX, type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { InfoTip } from "./InfoTip";

/** Situação do indicador frente à meta. */
export type StatusKpi = "bom" | "alerta" | "ruim";

const STATUS: Record<StatusKpi, { classe: string; cor: string; icone: LucideIcon; texto: string }> =
  {
    bom: {
      classe: "border-status-good/30 bg-status-good-bg text-status-good-fg",
      cor: "var(--status-good)",
      icone: CircleCheck,
      texto: "Bom",
    },
    alerta: {
      classe: "border-status-warn/30 bg-status-warn-bg text-status-warn-fg",
      cor: "var(--status-warn)",
      icone: AlertTriangle,
      texto: "Atenção",
    },
    ruim: {
      classe: "border-status-bad/30 bg-status-bad-bg text-status-bad-fg",
      cor: "var(--status-bad)",
      icone: CircleX,
      texto: "Crítico",
    },
  };

interface KpiCardProps {
  rotulo: string;
  /** Já formatado ("95,1%", "1.234"). */
  valor: string;
  status: StatusKpi;
  /** Linha de apoio no rodapé do cartão (meta, comparação). */
  detalhe: string;
  /** Etiqueta da situação ao lado do número (ex.: "abaixo da meta"). */
  selo?: string | undefined;
  /** Barra de progresso, fração 0–1. */
  progresso?: number | undefined;
  /** Indicador sem semântica de bom/ruim (volume): sem selo de situação. */
  neutro?: boolean | undefined;
  /** Ícone no quadrado do canto (identidade do indicador). */
  icone?: LucideIcon | undefined;
  /** Explicação do indicador no (i) ao lado do rótulo. */
  dica?: string | undefined;
  /** Conteúdo interativo no rodapé, à direita (ex.: link "ver códigos"); fica fora do clique do card. */
  extra?: ReactNode;
  /** Torna o card clicável (ex.: filtrar a lista abaixo). */
  aoClicar?: (() => void) | undefined;
  /** Destaca o card como filtro ativo. */
  ativo?: boolean | undefined;
}

/**
 * Cartão de indicador no desenho do mockup: rótulo em caixa alta, número grande com o selo da
 * situação (ícone + texto, nunca só cor), ícone no canto e rodapé com a comparação.
 * origem: components/common/KpiCard.tsx (sistema atual)
 */
export function KpiCard({
  rotulo,
  valor,
  status,
  detalhe,
  selo,
  progresso,
  neutro,
  icone: Icone,
  dica,
  extra,
  aoClicar,
  ativo,
}: KpiCardProps) {
  const s = STATUS[status];
  const IconeStatus = s.icone;
  const mostrarSelo = !neutro || selo;
  // Card clicável = botão que cobre o card inteiro por baixo do conteúdo; o (i) e o `extra` ficam
  // por cima e continuam clicáveis (botão dentro de botão quebraria teclado e leitor de tela).
  const classe = cn(
    "group relative flex w-full flex-col rounded-2xl border border-border bg-superficie p-1 text-left shadow-cartao",
    aoClicar &&
      "transition-[box-shadow,border-color] hover:border-brand/40 hover:shadow-flutuante has-[>button:focus-visible]:outline-2 has-[>button:focus-visible]:outline-offset-2 has-[>button:focus-visible]:outline-ring",
    ativo && "border-brand ring-2 ring-brand/30",
  );
  const interativo = "pointer-events-auto relative z-10";
  return (
    <div className={classe}>
      {aoClicar && (
        <button
          type="button"
          onClick={aoClicar}
          aria-pressed={!!ativo}
          aria-label={`${rotulo}: ${valor}. ${detalhe}`}
          className="absolute inset-0 z-0 cursor-pointer rounded-2xl focus-visible:outline-none"
        />
      )}
      <div className="pointer-events-none relative flex flex-1 flex-col rounded-xl border border-border bg-card px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <span className="flex items-center gap-1.5 pt-0.5">
            <span className="label-xs">{rotulo}</span>
            {dica && <InfoTip texto={dica} className={interativo} />}
          </span>
          {Icone && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border text-brand">
              <Icone className="h-[18px] w-[18px]" aria-hidden />
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="num-hero text-foreground">{valor}</span>
          {mostrarSelo && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
                s.classe,
              )}
            >
              <IconeStatus className="h-3.5 w-3.5" aria-hidden />
              {selo ?? s.texto}
            </span>
          )}
        </div>
        {progresso != null && (
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={rotulo}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(Math.min(1, Math.max(0, progresso)) * 100)}
          >
            <div
              className="h-full rounded-full transition-[width]"
              style={{
                width: `${String(Math.max(2, Math.min(100, progresso * 100)))}%`,
                backgroundColor: neutro ? "var(--brand)" : s.cor,
              }}
            />
          </div>
        )}
      </div>
      <div className="pointer-events-none relative flex min-h-9 items-center gap-2 px-3 py-2 text-[12.5px] text-muted-foreground">
        <span className="flex-1">{detalhe}</span>
        {extra && <span className={interativo}>{extra}</span>}
        {aoClicar && (
          <ArrowRight
            className="h-4 w-4 shrink-0 text-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
