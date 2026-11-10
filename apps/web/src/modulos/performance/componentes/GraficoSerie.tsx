import { type MetricaDaSerie, valorDaMetrica } from "@erp/dominio/performance/serie";
import { type Granularidade, type PontoSerie } from "@erp/shared/contratos/performance";
import { useState } from "react";

import { fmtInt } from "../formato";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const DEFINICAO: Record<
  "sla_op" | "sla_cli" | "volume",
  { rotulo: string; pct: boolean; detalhe: (p: PontoSerie) => string }
> = {
  sla_op: {
    rotulo: "SLA Operacional",
    pct: true,
    detalhe: (p) => `${fmtInt(p.totalCtrcs)} emitidos · ${fmtInt(p.foraPrazoOp)} fora do prazo`,
  },
  sla_cli: {
    rotulo: "SLA Cliente",
    pct: true,
    detalhe: (p) => `${fmtInt(p.noPrazoCli)} no prazo · ${fmtInt(p.foraPrazoCli)} fora`,
  },
  volume: {
    rotulo: "CT-e emitidos",
    pct: false,
    detalhe: (p) => `${fmtInt(p.entregue)} entregues`,
  },
};
type Metrica = keyof typeof DEFINICAO;

export function rotuloDoPeriodo(iso: string, g: Granularidade, longo = false): string {
  const [ano = "", mes = "", dia = ""] = iso.split("-");
  const nomeMes = MESES[Number(mes) - 1] ?? mes;
  if (g === "mes") return longo ? `${nomeMes}/${ano}` : nomeMes;
  return longo ? `${dia}/${mes}/${ano}` : `${dia}/${mes}`;
}

const L = 640;
const A = 220;
const MARGEM = { esq: 40, dir: 8, topo: 10, base: 22 };

/**
 * Evolução dia a dia ou mês a mês (SLA Op., SLA Cliente ou volume), com a meta tracejada.
 * TODO(kit-ui): trocar pelo gráfico de linha do kit quando chegar à main.
 */
export function GraficoSerie({
  titulo,
  subtitulo,
  pontos,
  granularidade,
  meta,
  carregando,
  erro,
}: {
  titulo: string;
  subtitulo: string;
  pontos: readonly PontoSerie[] | undefined;
  granularidade: Granularidade;
  meta: number;
  carregando: boolean;
  erro: Error | null;
}) {
  const [metrica, setMetrica] = useState<Metrica>("sla_op");
  const [foco, setFoco] = useState<number | null>(null);
  const def = DEFINICAO[metrica];
  const dados = (pontos ?? []).map((p) => {
    const v = valorDaMetrica(metrica satisfies MetricaDaSerie, p);
    return { p, v: v == null ? null : def.pct ? v * 100 : v };
  });
  const valores = dados.flatMap((d) => (d.v == null ? [] : [d.v]));
  const piso = def.pct
    ? Math.max(0, Math.floor(Math.min(...valores, meta * 100, 100) / 5) * 5 - 5)
    : 0;
  const teto = def.pct ? 100 : Math.max(1, ...valores);
  const largura = L - MARGEM.esq - MARGEM.dir;
  const altura = A - MARGEM.topo - MARGEM.base;
  const x = (i: number) =>
    MARGEM.esq + (dados.length <= 1 ? largura / 2 : (i / (dados.length - 1)) * largura);
  const y = (v: number) => MARGEM.topo + altura - ((v - piso) / (teto - piso || 1)) * altura;
  const trechos: string[] = [];
  dados.forEach((d, i) => {
    if (d.v == null) return;
    const anterior = dados[i - 1];
    trechos.push(`${anterior?.v == null ? "M" : "L"}${x(i).toFixed(1)},${y(d.v).toFixed(1)}`);
  });
  const passoRotulo = Math.max(1, Math.ceil(dados.length / 10));
  const focado = foco == null ? null : dados[foco];

  return (
    <section className="rounded-[10px] border border-border/70 bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="text-[13px] font-medium">{titulo}</h2>
          <p className="text-[11px] text-muted-foreground">{subtitulo}</p>
        </div>
        <div className="flex rounded-md border border-border/70 p-0.5">
          {(Object.keys(DEFINICAO) as Metrica[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMetrica(m); }}
              className={
                "rounded-[5px] px-3 py-1 text-[12px] transition-colors " +
                (metrica === m
                  ? "bg-[var(--brand)] text-white"
                  : "text-muted-foreground hover:bg-muted")
              }
            >
              {DEFINICAO[m].rotulo}
            </button>
          ))}
        </div>
      </header>
      <div className="relative h-[260px] p-4">
        {erro ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-[12px] text-destructive">
            {erro.message}
          </div>
        ) : carregando && !pontos ? (
          <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
            Carregando…
          </div>
        ) : valores.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
            Sem CTRCs no período.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${L} ${A}`}
            className="h-full w-full"
            role="img"
            aria-label={`${def.rotulo} por ${granularidade === "mes" ? "mês" : "dia"}`}
            onMouseLeave={() => { setFoco(null); }}
          >
            {[piso, (piso + teto) / 2, teto].map((v) => (
              <g key={v}>
                <line
                  x1={MARGEM.esq}
                  x2={L - MARGEM.dir}
                  y1={y(v)}
                  y2={y(v)}
                  stroke="var(--border)"
                />
                <text
                  x={MARGEM.esq - 4}
                  y={y(v) + 3}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--muted-foreground)"
                >
                  {def.pct ? `${Math.round(v)}%` : fmtInt(Math.round(v))}
                </text>
              </g>
            ))}
            {def.pct && (
              <line
                x1={MARGEM.esq}
                x2={L - MARGEM.dir}
                y1={y(meta * 100)}
                y2={y(meta * 100)}
                stroke="var(--status-good)"
                strokeDasharray="4 4"
              />
            )}
            <path d={trechos.join(" ")} fill="none" stroke="var(--brand)" strokeWidth="2" />
            {dados.map((d, i) => (
              <g key={d.p.periodo} onMouseEnter={() => { setFoco(i); }}>
                <rect
                  x={x(i) - largura / Math.max(1, dados.length) / 2}
                  y={MARGEM.topo}
                  width={largura / Math.max(1, dados.length)}
                  height={altura}
                  fill="transparent"
                />
                {d.v != null && (
                  <circle cx={x(i)} cy={y(d.v)} r={foco === i ? 4 : 2.5} fill="var(--brand)" />
                )}
                {i % passoRotulo === 0 && (
                  <text
                    x={x(i)}
                    y={A - 6}
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--muted-foreground)"
                  >
                    {rotuloDoPeriodo(d.p.periodo, granularidade)}
                  </text>
                )}
              </g>
            ))}
          </svg>
        )}
        {focado && (
          <div className="pointer-events-none absolute top-4 right-4 rounded-lg border border-border bg-card px-3 py-2 text-[12px] shadow-sm">
            <div className="font-medium">
              {rotuloDoPeriodo(focado.p.periodo, granularidade, true)}
            </div>
            <div className="mt-0.5 tabular-nums">
              {def.rotulo}:{" "}
              {focado.v == null
                ? "—"
                : def.pct
                  ? `${focado.v.toFixed(1).replace(".", ",")}%`
                  : fmtInt(focado.v)}
            </div>
            <div className="text-[11px] text-muted-foreground tabular-nums">
              {def.detalhe(focado.p)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
