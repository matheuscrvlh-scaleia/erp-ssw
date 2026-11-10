import { valorDaMetrica } from "@erp/dominio/performance/serie";
import { type Granularidade, type PontoSerie } from "@erp/shared/contratos/performance";
import { formatarInteiro, formatarPercentual } from "@erp/shared/formatacao";
import { useState } from "react";

import { GraficoLinha } from "@/componentes/comum/Graficos";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const DEFINICAO = {
  sla_op: {
    rotulo: "SLA Operacional",
    pct: true,
    detalhe: (p: PontoSerie) =>
      `${formatarInteiro(p.totalCtrcs)} emitidos · ${formatarInteiro(p.foraPrazoOp)} fora do prazo`,
  },
  sla_cli: {
    rotulo: "SLA Cliente",
    pct: true,
    detalhe: (p: PontoSerie) =>
      `${formatarInteiro(p.noPrazoCli)} no prazo · ${formatarInteiro(p.foraPrazoCli)} fora`,
  },
  volume: {
    rotulo: "CT-e emitidos",
    pct: false,
    detalhe: (p: PontoSerie) => `${formatarInteiro(p.entregue)} entregues`,
  },
} as const;
type Metrica = keyof typeof DEFINICAO;
const METRICAS = Object.keys(DEFINICAO) as Metrica[];

export function rotuloDoPeriodo(iso: string, g: Granularidade, longo = false): string {
  const [ano = "", mes = "", dia = ""] = iso.split("-");
  const nomeMes = MESES[Number(mes) - 1] ?? mes;
  if (g === "mes") return longo ? `${nomeMes}/${ano}` : nomeMes;
  return longo ? `${dia}/${mes}/${ano}` : `${dia}/${mes}`;
}

/** Evolução dia a dia ou mês a mês (SLA Op., SLA Cliente ou volume), com a meta tracejada. */
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
  /** Fração 0–1. */
  meta: number;
  carregando: boolean;
  erro: Error | null;
}) {
  const [metrica, setMetrica] = useState<Metrica>("sla_op");
  const def = DEFINICAO[metrica];
  const dados = (pontos ?? []).map((p) => ({
    ponto: p,
    rotulo: rotuloDoPeriodo(p.periodo, granularidade),
    valor: valorDaMetrica(metrica, p),
  }));
  const valores = dados.flatMap((d) => (d.valor == null ? [] : [d.valor]));
  // Eixo do percentual começa 5 p.p. abaixo do menor valor (ou da meta), em degraus de 5.
  const piso = Math.max(0, Math.floor(Math.min(...valores, meta, 1) * 20) / 20 - 0.05);
  return (
    <section className="rounded-[10px] border border-border/70 bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="text-[13px] font-medium">{titulo}</h2>
          <p className="text-[11px] text-muted-foreground">{subtitulo}</p>
        </div>
        <div className="flex rounded-md border border-border/70 p-0.5">
          {METRICAS.map((m) => (
            <button
              key={m}
              onClick={() => {
                setMetrica(m);
              }}
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
      <GraficoLinha
        descricao={`${def.rotulo} por ${granularidade === "mes" ? "mês" : "dia"}`}
        dados={dados}
        eixoX="rotulo"
        series={[{ chave: "valor", nome: def.rotulo }]}
        formato={def.pct ? "percentual" : "inteiro"}
        dominioY={def.pct ? [piso, 1] : undefined}
        meta={def.pct ? { valor: meta, rotulo: `meta ${formatarPercentual(meta)}` } : undefined}
        dica={(d) => (
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-[12px] shadow-sm">
            <div className="font-medium">
              {rotuloDoPeriodo(d.ponto.periodo, granularidade, true)}
            </div>
            <div className="mt-0.5 tabular-nums">
              {def.rotulo}:{" "}
              {d.valor == null
                ? "—"
                : def.pct
                  ? formatarPercentual(d.valor)
                  : formatarInteiro(d.valor)}
            </div>
            <div className="text-[11px] text-muted-foreground tabular-nums">
              {def.detalhe(d.ponto)}
            </div>
          </div>
        )}
        carregando={carregando && !pontos}
        erro={erro}
      />
    </section>
  );
}
