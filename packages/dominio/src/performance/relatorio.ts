import {
  type AgregadosProducao,
  type BlocoProducao,
  type ImpactoCodigo,
  type Pontualidade,
  type TotaisResumo,
  type UnidadePontualidade,
  type UnidadeRelatorio,
  type UnidadeResumo,
} from "@erp/shared/contratos/performance";

import { compararTexto } from "./primitivas";

/**
 * Bloco de Produção/Qualidade (linha de Produção da tela e cards do relatório).
 * Decisão Q01: SLA Operacional e SLA Cliente saem em 0–100 como os demais percentuais (o sistema
 * atual deixava a fração 0–1 e o relatório mostrava "1,0%" no lugar de "95,7%"). Os nomes
 * continuam trocados de propósito: `slaOperacionalPct` é o SLA por ocorrência penalizante (rótulo
 * "SLA de Pontualidade") e `slaPontualidadePct` é a pontualidade sobre emitidos ("SLA Operacional").
 * origem: montarBlocoRelatorio (sistema atual)
 */
export function montarBloco(
  agregados: AgregadosProducao,
  resumo: TotaisResumo,
  pontualidade: Pontualidade | null,
): BlocoProducao {
  const pont = pontualidade?.totais;
  const comoPct = (fracao: number | null | undefined) => (fracao == null ? null : fracao * 100);
  return {
    totalCtrcs: agregados.totalCtrcs || resumo.totalCtrcs,
    entregues: agregados.entregues,
    finalizadoSistema: agregados.finalizadoSemEntrega,
    previstos: agregados.previstos,
    devolvidos: agregados.devolvidos,
    noPrazo: pont?.noPrazo ?? 0,
    foraPrazo: pont?.foraPrazo ?? 0,
    pendentePrazo: pont?.pendente ?? 0,
    semPrazo: pont?.semPrazo ?? 0,
    valorFreteTotal: agregados.valorFreteTotal,
    valorFretePerdido: agregados.valorFretePerdido,
    pctFretePerdido:
      agregados.valorFreteTotal > 0
        ? (agregados.valorFretePerdido / agregados.valorFreteTotal) * 100
        : null,
    slaOperacionalPct: resumo.performance * 100,
    slaPontualidadePct: comoPct(pont?.performancePct),
    taxaRetornoPct: resumo.taxaRetorno * 100,
    totalCliente: pont?.totalCliente ?? 0,
    noPrazoCliente: pont?.noPrazoCliente ?? 0,
    foraPrazoCliente: pont?.foraPrazoCliente ?? 0,
    slaClientePct: comoPct(pont?.slaClientePct),
  };
}

/** Emitidos e entregues por filial efetiva (relatório; sem o filtro de tipo, como hoje). */
export interface ProducaoDaUnidade {
  sigla: string;
  emitidos: number;
  entregues: number;
}

/**
 * Tabela "SLA por unidade" do relatório: siglas do resumo e da pontualidade, sem as que não têm
 * CT-e no resumo, da pior para a melhor pelo SLA por ocorrência penalizante.
 * origem: computeSnapshot (performance-relatorio.server.ts, sistema atual)
 */
export function unidadesDoRelatorio(
  resumo: readonly UnidadeResumo[],
  pontualidade: readonly UnidadePontualidade[],
  producao: readonly ProducaoDaUnidade[],
): UnidadeRelatorio[] {
  const doResumo = new Map(resumo.map((u) => [u.sigla, u]));
  const daPont = new Map(pontualidade.map((u) => [u.sigla, u]));
  const daProducao = new Map(producao.map((u) => [u.sigla, u]));
  const siglas = [...new Set([...doResumo.keys(), ...daPont.keys()])];
  return siglas
    .map((sigla) => {
      const r = doResumo.get(sigla);
      const p = daPont.get(sigla);
      const prod = daProducao.get(sigla);
      const total = r?.total ?? 0;
      const emitidos = prod?.emitidos ?? total;
      const entregues = prod?.entregues ?? 0;
      return {
        sigla,
        cidade: null,
        uf: null,
        total,
        entregues,
        producaoPct: emitidos > 0 ? (entregues / emitidos) * 100 : null,
        slaOperacionalPct: r ? r.performance * 100 : null,
        slaPontualidadePct: p?.performancePct != null ? p.performancePct * 100 : null,
      };
    })
    .filter((u) => u.total > 0)
    .sort(
      (a, b) =>
        (a.slaOperacionalPct ?? Infinity) - (b.slaOperacionalPct ?? Infinity) ||
        compararTexto(a.sigla, b.sigla),
    );
}

/** Linha de impacto como sai da consulta (código do BI2 0013 só com dígitos). */
export interface ImpactoBruto {
  codigo: string;
  descricao: string | null;
  penaliza: boolean;
  totalCtrcs: number;
  totalPenalizantes: number;
}

/**
 * Impacto por código de última ocorrência: ordena (penaliza, penalizantes, CT-e), aplica o filtro de
 * códigos comparando o TEXTO (como hoje) e calcula o percentual sobre a base que sobrou.
 * origem: performance_impacto_codigos + computeSnapshot (sistema atual)
 */
export function impactoDosCodigos(
  linhas: readonly ImpactoBruto[],
  codigosDoFiltro: readonly string[] | null,
): { linhas: ImpactoCodigo[]; base: number } {
  const ordenadas = [...linhas].sort(
    (a, b) =>
      Number(b.penaliza) - Number(a.penaliza) ||
      b.totalPenalizantes - a.totalPenalizantes ||
      b.totalCtrcs - a.totalCtrcs ||
      compararTexto(a.codigo, b.codigo),
  );
  const filtradas =
    codigosDoFiltro && codigosDoFiltro.length > 0
      ? ordenadas.filter((l) => codigosDoFiltro.includes(l.codigo))
      : ordenadas;
  const base = filtradas.reduce((s, l) => s + l.totalCtrcs, 0);
  return {
    base,
    linhas: filtradas.map((l) => ({
      ...l,
      pctDoTotal: base > 0 ? (l.totalCtrcs / base) * 100 : 0,
    })),
  };
}

// ---------------------------------------------------------------- derivados e comparativo (tela)

interface DerivadosDoBloco {
  totalPrazo: number;
  pctNoPrazo: number | null;
  /** Exibido como "% Penalizado Op.": fora do prazo sobre os emitidos. */
  pctPenalizadoPont: number | null;
  /** Exibido como "% Penalizado Pont.": complemento do SLA por ocorrência penalizante. */
  pctPenalizadoOp: number | null;
  pctProducao: number | null;
}

/** origem: derive (RelatorioPeriodoPanel.tsx, sistema atual) */
export function derivadosDoBloco(b: BlocoProducao): DerivadosDoBloco {
  const totalPrazo = b.noPrazo + b.foraPrazo;
  return {
    totalPrazo,
    pctNoPrazo: totalPrazo > 0 ? (b.noPrazo / totalPrazo) * 100 : null,
    pctPenalizadoPont: b.totalCtrcs > 0 ? (b.foraPrazo / b.totalCtrcs) * 100 : null,
    pctPenalizadoOp: b.slaOperacionalPct != null ? 100 - b.slaOperacionalPct : null,
    pctProducao: b.totalCtrcs > 0 ? (b.entregues / b.totalCtrcs) * 100 : null,
  };
}

type TomDoDelta = "bom" | "ruim" | "neutro";
export interface Delta {
  texto: string;
  tom: TomDoDelta;
}

const umaCasa = (v: number) => Math.abs(v).toFixed(1).replace(".", ",");

/** Diferença em pontos percentuais. origem: deltaPP (RelatorioPeriodoPanel.tsx) */
export function deltaPP(
  atual: number | null,
  comparado: number | null,
  maiorMelhor = true,
): Delta | null {
  if (atual == null || comparado == null) return null;
  const diff = atual - comparado;
  if (Math.abs(diff) < 0.05) return { texto: "0,0 pp", tom: "neutro" };
  const subiu = diff > 0;
  return {
    texto: `${subiu ? "▲" : "▼"} ${umaCasa(diff)} pp`,
    tom: subiu === maiorMelhor ? "bom" : "ruim",
  };
}

/** Variação relativa (%) de contagens e valores. origem: deltaPctAbs (RelatorioPeriodoPanel.tsx) */
export function deltaPctAbs(atual: number, comparado: number, maiorMelhor = true): Delta {
  if (comparado === 0) {
    if (atual === 0) return { texto: "0,0%", tom: "neutro" };
    return { texto: atual > 0 ? "▲ n/a" : "▼ n/a", tom: "neutro" };
  }
  const diff = ((atual - comparado) / Math.abs(comparado)) * 100;
  if (Math.abs(diff) < 0.05) return { texto: "0,0%", tom: "neutro" };
  const subiu = diff > 0;
  return {
    texto: `${subiu ? "▲" : "▼"} ${umaCasa(diff)}%`,
    tom: subiu === maiorMelhor ? "bom" : "ruim",
  };
}

/** Rótulo do prejuízo pelos códigos do filtro. origem: prejuizoSubtitulo (PrejuizoLabel.tsx) */
export function subtituloDoPrejuizo(
  codigos: readonly (string | number)[] | null | undefined,
): string {
  return codigos && codigos.length > 0 ? `códigos ${codigos.join(", ")}` : "código 13";
}

/** Status da unidade no Excel do relatório. origem: unidadesRows (relatorio-semanal-export.ts) */
export function statusDaUnidade(sla: number | null, metaPct: number): string {
  if (sla == null) return "—";
  if (sla >= metaPct) return "Verde";
  return sla >= metaPct - 5 ? "Amarelo" : "Vermelho";
}
