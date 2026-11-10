import {
  type Delta,
  deltaPctAbs,
  deltaPP,
  derivadosDoBloco,
  subtituloDoPrejuizo,
} from "@erp/dominio/performance/relatorio";
import { type BlocoProducao, type RelatorioPeriodo } from "@erp/shared/contratos/performance";

import { fmtInt, fmtPct100 } from "./formato";

export type TomDoIndicador = "neutral" | "good" | "bad";

export interface Indicador {
  secao: "Produção" | "Qualidade";
  rotulo: string;
  valor: string;
  legenda?: string;
  sub?: string;
  dica?: string;
  tom: TomDoIndicador;
  comparativo: { valor: string; delta: Delta | null } | null;
}

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Tom do SLA no relatório: verde na meta, vermelho abaixo de meta − 5, neutro entre os dois. */
function tomDoSla(v: number | null, meta: number): TomDoIndicador {
  if (v == null) return "neutral";
  if (v >= meta) return "good";
  return v >= meta - 5 ? "neutral" : "bad";
}

/**
 * Indicadores do relatório de período, na ordem e com os nomes de hoje (decisão Q01: escala em
 * 0–100 corrigida, nomes mantidos). origem: RelatorioPeriodoPanel.tsx (Body)
 */
export function indicadoresDoRelatorio(
  r: RelatorioPeriodo,
  codigosDoFiltro: readonly string[],
): Indicador[] {
  const a = r.atual;
  const c = r.comparativo?.atual ?? null;
  const meta = r.limites.slaMetaPct;
  const d = derivadosDoBloco(a);
  const dc = c ? derivadosDoBloco(c) : null;
  const metaTexto = `meta ${meta.toFixed(1).replace(".", ",")}%`;
  const cmp = (
    valor: (b: BlocoProducao) => string,
    delta: (b: BlocoProducao) => Delta | null,
  ): Indicador["comparativo"] => (c ? { valor: valor(c), delta: delta(c) } : null);
  const cmpDerivado = (
    chave: "pctProducao" | "pctNoPrazo" | "pctPenalizadoOp" | "pctPenalizadoPont",
    maiorMelhor: boolean,
  ): Indicador["comparativo"] =>
    dc ? { valor: fmtPct100(dc[chave]), delta: deltaPP(d[chave], dc[chave], maiorMelhor) } : null;

  return [
    {
      secao: "Produção",
      rotulo: "CT-e emitidos",
      valor: fmtInt(a.totalCtrcs),
      sub: "Total no período",
      tom: "neutral",
      comparativo: cmp(
        (b) => fmtInt(b.totalCtrcs),
        (b) => deltaPctAbs(a.totalCtrcs, b.totalCtrcs, true),
      ),
    },
    {
      secao: "Produção",
      rotulo: "Entregues",
      valor: fmtInt(a.entregues),
      sub: `de ${fmtInt(a.totalCtrcs)} emitidos`,
      tom: "neutral",
      comparativo: cmp(
        (b) => fmtInt(b.entregues),
        (b) => deltaPctAbs(a.entregues, b.entregues, true),
      ),
    },
    {
      secao: "Produção",
      rotulo: "Finalizado em Sistema",
      valor: fmtInt(a.finalizadoSistema),
      sub: "CTRCs baixados sem entrega (12/36/61/77/92/93/94/99)",
      dica: "CTRCs finalizados no sistema por códigos de baixa administrativa",
      tom: "neutral",
      comparativo: cmp(
        (b) => fmtInt(b.finalizadoSistema),
        (b) => deltaPctAbs(a.finalizadoSistema, b.finalizadoSistema, false),
      ),
    },
    {
      secao: "Produção",
      rotulo: "% Produção",
      valor: fmtPct100(d.pctProducao),
      sub: `${fmtInt(a.entregues)} / ${fmtInt(a.totalCtrcs)} entregues no período`,
      dica: "Percentual de CT-e emitidos no período que já foram entregues",
      tom: "neutral",
      comparativo: cmpDerivado("pctProducao", true),
    },
    {
      secao: "Qualidade",
      rotulo: "% No prazo",
      valor: fmtPct100(d.pctNoPrazo),
      legenda: "Entregues até a data combinada",
      sub: `${fmtInt(a.noPrazo)} de ${fmtInt(d.totalPrazo)} com prazo`,
      tom: d.pctNoPrazo != null && d.pctNoPrazo >= meta ? "good" : "neutral",
      comparativo: cmpDerivado("pctNoPrazo", true),
    },
    {
      secao: "Qualidade",
      rotulo: "% Penalizado Pont.",
      valor: fmtPct100(d.pctPenalizadoOp),
      sub: "ocorrências penalizantes",
      dica: "Percentual de CTRCs com ocorrência penalizante (exclui responsabilidade do cliente)",
      tom: d.pctPenalizadoOp != null && d.pctPenalizadoOp > 100 - meta ? "bad" : "neutral",
      comparativo: cmpDerivado("pctPenalizadoOp", false),
    },
    {
      secao: "Qualidade",
      rotulo: "% Penalizado Op.",
      valor: fmtPct100(d.pctPenalizadoPont),
      legenda: "Entregues depois da data combinada",
      sub: `${fmtInt(a.foraPrazo)} fora do prazo`,
      dica: "Entregues fora do prazo sobre os CT-e emitidos (complemento do SLA Operacional)",
      tom: d.pctPenalizadoPont != null && d.pctPenalizadoPont > 100 - meta ? "bad" : "neutral",
      comparativo: cmpDerivado("pctPenalizadoPont", false),
    },
    {
      secao: "Qualidade",
      rotulo: "SLA de Pontualidade",
      valor: fmtPct100(a.slaOperacionalPct),
      sub: metaTexto,
      dica: "Baseado em ocorrências penalizantes registradas nos CTRCs.",
      tom: tomDoSla(a.slaOperacionalPct, meta),
      comparativo: cmp(
        (b) => fmtPct100(b.slaOperacionalPct),
        (b) => deltaPP(a.slaOperacionalPct, b.slaOperacionalPct, true),
      ),
    },
    {
      secao: "Qualidade",
      rotulo: "SLA Cliente",
      valor: fmtPct100(a.slaClientePct),
      sub:
        a.slaClientePct != null
          ? `${fmtInt(a.noPrazoCliente)} no prazo · ${fmtInt(a.foraPrazoCliente)} fora`
          : a.totalCliente === 0
            ? "Sem CTRCs de responsabilidade do cliente"
            : "Aguardando dados de pontualidade",
      dica: "Pontualidade dos CTRCs cujo atraso é de responsabilidade do cliente/parceiro — universo separado, não soma com o SLA de Pontualidade.",
      tom: tomDoSla(a.slaClientePct, meta),
      comparativo: cmp(
        (b) => fmtPct100(b.slaClientePct),
        (b) => deltaPP(a.slaClientePct, b.slaClientePct, true),
      ),
    },
    {
      secao: "Qualidade",
      rotulo: "SLA Operacional",
      valor: fmtPct100(a.slaPontualidadePct),
      sub: metaTexto,
      dica: "CT-e emitidos menos os entregues fora do prazo, sobre os CT-e emitidos. Fora do prazo exclui responsabilidade do cliente.",
      tom: a.slaPontualidadePct != null && a.slaPontualidadePct >= meta ? "good" : "neutral",
      comparativo: cmp(
        (b) => fmtPct100(b.slaPontualidadePct),
        (b) => deltaPP(a.slaPontualidadePct, b.slaPontualidadePct, true),
      ),
    },
    {
      secao: "Qualidade",
      rotulo: "Prejuízo",
      valor: reais(a.valorFretePerdido),
      sub: `${subtituloDoPrejuizo(codigosDoFiltro)} · ${fmtPct100(a.pctFretePerdido)} de ${reais(a.valorFreteTotal)} (romaneados)`,
      dica: "Valor de frete de CTRCs romaneados (com ocorrência 85) cuja ocorrência penalizante é o(s) código(s) indicado(s), sobre o valor total de romaneados no período",
      tom: "bad",
      comparativo: cmp(
        (b) => reais(b.valorFretePerdido),
        (b) => deltaPctAbs(a.valorFretePerdido, b.valorFretePerdido, false),
      ),
    },
  ];
}

/** Linhas do CSV do relatório: indicadores e SLA por unidade. */
export function linhasDoCsv(
  r: RelatorioPeriodo,
  codigosDoFiltro: readonly string[],
): { secao: string; item: string; valor: string; comparativo: string }[] {
  const indicadores = indicadoresDoRelatorio(r, codigosDoFiltro).map((i) => ({
    secao: i.secao,
    item: i.rotulo,
    valor: i.valor,
    comparativo: i.comparativo?.valor ?? "",
  }));
  const comparadas = new Map((r.comparativo?.porUnidade ?? []).map((u) => [u.sigla, u]));
  const unidades = r.porUnidade.map((u) => ({
    secao: "SLA por unidade",
    item: u.sigla,
    valor: `${fmtInt(u.total)} emitidos · SLA Pont. ${fmtPct100(u.slaOperacionalPct)} · SLA Op. ${fmtPct100(u.slaPontualidadePct)}`,
    comparativo: comparadas.has(u.sigla)
      ? `SLA Pont. ${fmtPct100(comparadas.get(u.sigla)?.slaOperacionalPct ?? null)}`
      : "",
  }));
  return [...indicadores, ...unidades];
}
