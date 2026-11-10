import { type Granularidade, type PontoSerie } from "@erp/shared/contratos/performance";
import { diferencaEmDias, somarDias } from "@erp/shared/datas";

/** Janela do gráfico de evolução para o período da tela. */
export interface JanelaDaSerie {
  inicio: string;
  fim: string;
  granularidade: Granularidade;
  /** Período curto demais: a janela vira os 7 dias que terminam no fim. */
  ampliada: boolean;
}

/**
 * Menos de 7 dias → os 7 dias que terminam no fim, por dia; mais de 92 dias → por mês.
 * origem: performance.index.tsx (sistema atual)
 */
export function janelaDaSerie(inicio: string, fim: string): JanelaDaSerie {
  const dias = diferencaEmDias(inicio, fim) + 1;
  if (dias < 7) return { inicio: somarDias(fim, -6), fim, granularidade: "dia", ampliada: true };
  return { inicio, fim, granularidade: dias > 92 ? "mes" : "dia", ampliada: false };
}

const inicioDoMes = (iso: string) => `${iso.slice(0, 7)}-01`;

function proximoMes(iso: string): string {
  const ano = Number(iso.slice(0, 4));
  const mes = Number(iso.slice(5, 7));
  return mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
}

/** Eixo completo de `trunc(inicio)` a `trunc(fim)`, dia a dia ou mês a mês. */
export function eixoDaSerie(inicio: string, fim: string, granularidade: Granularidade): string[] {
  const eixo: string[] = [];
  if (granularidade === "dia") {
    for (let d = inicio; d <= fim; d = somarDias(d, 1)) eixo.push(d);
    return eixo;
  }
  for (let m = inicioDoMes(inicio); m <= inicioDoMes(fim); m = proximoMes(m)) eixo.push(m);
  return eixo;
}

/** Período (dia ou 1º do mês) de uma data da base. */
export function periodoDaData(data: string, granularidade: Granularidade): string {
  return granularidade === "dia" ? data : inicioDoMes(data);
}

const zerado = (periodo: string): PontoSerie => ({
  periodo,
  totalCtrcs: 0,
  entregue: 0,
  foraTransp: 0,
  noPrazoOp: 0,
  foraPrazoOp: 0,
  noPrazoCli: 0,
  foraPrazoCli: 0,
});

/**
 * Preenche o eixo com zeros onde não há CT-e e soma os pontos do mesmo período.
 * origem: sla_serie (sistema atual)
 */
export function completarSerie(
  pontos: readonly PontoSerie[],
  inicio: string,
  fim: string,
  granularidade: Granularidade,
): PontoSerie[] {
  const porPeriodo = new Map<string, PontoSerie>();
  for (const p of pontos) {
    const chave = periodoDaData(p.periodo, granularidade);
    const atual = porPeriodo.get(chave) ?? zerado(chave);
    porPeriodo.set(chave, {
      periodo: chave,
      totalCtrcs: atual.totalCtrcs + p.totalCtrcs,
      entregue: atual.entregue + p.entregue,
      foraTransp: atual.foraTransp + p.foraTransp,
      noPrazoOp: atual.noPrazoOp + p.noPrazoOp,
      foraPrazoOp: atual.foraPrazoOp + p.foraPrazoOp,
      noPrazoCli: atual.noPrazoCli + p.noPrazoCli,
      foraPrazoCli: atual.foraPrazoCli + p.foraPrazoCli,
    });
  }
  return eixoDaSerie(inicio, fim, granularidade).map((p) => porPeriodo.get(p) ?? zerado(p));
}

/** Métricas do gráfico. A do Ranking tem fórmula própria (entregues − atrasos da transportadora). */
export type MetricaDaSerie = "sla_op" | "sla_cli" | "sla_ranking" | "volume";

const razao = (num: number, den: number) => (den > 0 ? num / den : null);

/** origem: SlaSerieChart.tsx (sistema atual) */
export function valorDaMetrica(metrica: MetricaDaSerie, p: PontoSerie): number | null {
  switch (metrica) {
    case "sla_op":
      return razao(p.totalCtrcs - p.foraPrazoOp, p.totalCtrcs);
    case "sla_cli":
      return razao(p.noPrazoCli, p.noPrazoCli + p.foraPrazoCli);
    case "sla_ranking":
      return razao(p.entregue - p.foraTransp, p.entregue);
    case "volume":
      return p.totalCtrcs;
  }
}
