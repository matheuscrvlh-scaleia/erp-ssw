import { valorDaMetrica } from "@erp/dominio/performance/serie";
import { type Granularidade, type PontoSerie } from "@erp/shared/contratos/performance";
import { formatarInteiro, formatarPercentual } from "@erp/shared/formatacao";
import { BarChart3, LineChart } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Alternador } from "@/componentes/comum/Alternador";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { GraficoBarras, GraficoLinha } from "@/componentes/comum/Graficos";
import { ItemDeLegenda, Painel } from "@/componentes/comum/Painel";
import { type ColunaExportacao } from "@/lib/exportacao";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Cada tela escolhe as suas: o SLA do Ranking tem fórmula diferente do da Performance. */
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
  sla_ranking: {
    rotulo: "SLA",
    pct: true,
    detalhe: (p: PontoSerie) =>
      `${formatarInteiro(p.entregue)} entregues · ${formatarInteiro(p.foraTransp)} atrasos da transportadora`,
  },
  volume: {
    rotulo: "CT-e emitidos",
    pct: false,
    detalhe: (p: PontoSerie) => `${formatarInteiro(p.entregue)} entregues`,
  },
} as const;
export type MetricaDoGrafico = keyof typeof DEFINICAO;

export function rotuloDoPeriodo(iso: string, g: Granularidade, longo = false): string {
  const [ano = "", mes = "", dia = ""] = iso.split("-");
  const nomeMes = MESES[Number(mes) - 1] ?? mes;
  if (g === "mes") return longo ? `${nomeMes}/${ano}` : nomeMes;
  return longo ? `${dia}/${mes}/${ano}` : `${dia}/${mes}`;
}

/**
 * Exportação do gráfico: uma coluna por métrica da tela, percentual em 0–100 com 1 casa (vazio sem
 * base de cálculo). origem: colunasExport (SlaSerieChart.tsx, sistema atual)
 */
export function exportacaoDaSerie(
  pontos: readonly PontoSerie[],
  granularidade: Granularidade,
  metricas: readonly MetricaDoGrafico[],
): { colunas: ColunaExportacao[]; linhas: Record<string, string | number>[] } {
  const colunas: ColunaExportacao[] = [
    { chave: "periodo", titulo: granularidade === "mes" ? "Mês" : "Dia" },
    ...metricas.map((m) => ({
      chave: m,
      titulo: DEFINICAO[m].pct ? `${DEFINICAO[m].rotulo} (%)` : DEFINICAO[m].rotulo,
    })),
  ];
  const linhas = pontos.map((p) => {
    const linha: Record<string, string | number> = {
      periodo: rotuloDoPeriodo(p.periodo, granularidade, true),
    };
    for (const m of metricas) {
      const v = valorDaMetrica(m, p);
      linha[m] = v == null ? "" : DEFINICAO[m].pct ? Number((v * 100).toFixed(1)) : v;
    }
    return linha;
  });
  return { colunas, linhas };
}

/**
 * Evolução dia a dia ou mês a mês com as métricas da tela (a primeira abre selecionada), meta
 * tracejada nos percentuais, barras no volume e exportação. origem: SlaSerieChart.tsx
 */
export function GraficoSerie({
  titulo,
  subtitulo,
  pontos,
  granularidade,
  metricas,
  meta,
  carregando,
  erro,
  nomeExport,
  filtrosExtra,
}: {
  titulo: string;
  subtitulo: string;
  pontos: readonly PontoSerie[] | undefined;
  granularidade: Granularidade;
  metricas: readonly [MetricaDoGrafico, ...MetricaDoGrafico[]];
  /** Fração 0–1. */
  meta: number;
  carregando: boolean;
  erro: Error | null;
  /** Base do nome do arquivo exportado. */
  nomeExport: string;
  /** Controles extras no cabeçalho (ex.: seletor de ano). */
  filtrosExtra?: ReactNode;
}) {
  const [metrica, setMetrica] = useState<MetricaDoGrafico>(metricas[0]);
  const def = DEFINICAO[metrica];
  const dados = (pontos ?? []).map((p) => ({
    ponto: p,
    rotulo: rotuloDoPeriodo(p.periodo, granularidade),
    valor: valorDaMetrica(metrica, p),
  }));
  const valores = dados.flatMap((d) => (d.valor == null ? [] : [d.valor]));
  // Eixo do percentual começa 5 p.p. abaixo do menor valor (ou da meta), em degraus de 5.
  const piso = Math.max(0, Math.floor(Math.min(...valores, meta, 1) * 20) / 20 - 0.05);
  const exportacao = exportacaoDaSerie(pontos ?? [], granularidade, metricas);
  const comum = {
    descricao: `${def.rotulo} por ${granularidade === "mes" ? "mês" : "dia"}`,
    dados,
    eixoX: "rotulo",
    series: [{ chave: "valor", nome: def.rotulo }],
    dica: (d: (typeof dados)[number]) => (
      <>
        <div className="label-xs mb-1">{rotuloDoPeriodo(d.ponto.periodo, granularidade, true)}</div>
        <div className="tabular-nums">
          {def.rotulo}:{" "}
          <strong>
            {d.valor == null
              ? "sem base de cálculo"
              : def.pct
                ? formatarPercentual(d.valor)
                : formatarInteiro(d.valor)}
          </strong>
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">{def.detalhe(d.ponto)}</div>
        {def.pct && (
          <div className="text-xs text-muted-foreground tabular-nums">
            {formatarInteiro(d.ponto.totalCtrcs)} CT-e emitidos
          </div>
        )}
      </>
    ),
    carregando: carregando && !pontos,
    erro,
  };
  return (
    <Painel
      titulo={titulo}
      descricao={subtitulo}
      icone={def.pct ? LineChart : BarChart3}
      acoes={
        <ExportMenu
          arquivo={nomeExport}
          titulo={titulo}
          subtitulo={subtitulo}
          colunas={exportacao.colunas}
          linhas={exportacao.linhas}
          soIcone
        />
      }
      barra={
        <>
          {filtrosExtra}
          {metricas.length > 1 && (
            <Alternador
              rotulo="Métrica do gráfico"
              tamanho="pequeno"
              valor={metrica}
              aoMudar={setMetrica}
              opcoes={metricas.map((m) => ({ valor: m, rotulo: DEFINICAO[m].rotulo }))}
            />
          )}
          <span className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
            <ItemDeLegenda cor="var(--brand)">{def.rotulo}</ItemDeLegenda>
            {def.pct && (
              <ItemDeLegenda cor="var(--muted-foreground)">
                meta {formatarPercentual(meta)}
              </ItemDeLegenda>
            )}
          </span>
        </>
      }
    >
      {def.pct ? (
        <GraficoLinha
          {...comum}
          formato="percentual"
          dominioY={[piso, 1]}
          meta={{ valor: meta, rotulo: `meta ${formatarPercentual(meta)}` }}
        />
      ) : (
        <GraficoBarras {...comum} formato="inteiro" />
      )}
    </Painel>
  );
}
