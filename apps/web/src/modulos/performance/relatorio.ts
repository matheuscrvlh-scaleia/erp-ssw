import {
  type Delta,
  deltaPctAbs,
  deltaPP,
  derivadosDoBloco,
  statusDaUnidade,
  subtituloDoPrejuizo,
} from "@erp/dominio/performance/relatorio";
import { type BlocoProducao, type RelatorioPeriodo } from "@erp/shared/contratos/performance";
import { formatarInteiro, formatarMoeda, formatarPercentual } from "@erp/shared/formatacao";

import { type AbaExcel, type ColunaExportacao } from "@/lib/exportacao";

type TomDoIndicador = "neutro" | "bom" | "ruim";

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

/** Tom do SLA no relatório: verde na meta, vermelho abaixo de meta − 5, neutro entre os dois. */
function tomDoSla(v: number | null, meta: number): TomDoIndicador {
  if (v == null) return "neutro";
  if (v >= meta) return "bom";
  return v >= meta - 5 ? "neutro" : "ruim";
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
  const metaTexto = `meta ${formatarPercentual(meta, { escala: "cem" })}`;
  const cmp = (
    valor: (b: BlocoProducao) => string,
    delta: (b: BlocoProducao) => Delta | null,
  ): Indicador["comparativo"] => (c ? { valor: valor(c), delta: delta(c) } : null);
  const cmpDerivado = (
    chave: "pctProducao" | "pctNoPrazo" | "pctPenalizadoOp" | "pctPenalizadoPont",
    maiorMelhor: boolean,
  ): Indicador["comparativo"] =>
    dc
      ? {
          valor: formatarPercentual(dc[chave], { escala: "cem" }),
          delta: deltaPP(d[chave], dc[chave], maiorMelhor),
        }
      : null;

  return [
    {
      secao: "Produção",
      rotulo: "CT-e emitidos",
      valor: formatarInteiro(a.totalCtrcs),
      sub: "Total no período",
      tom: "neutro",
      comparativo: cmp(
        (b) => formatarInteiro(b.totalCtrcs),
        (b) => deltaPctAbs(a.totalCtrcs, b.totalCtrcs, true),
      ),
    },
    {
      secao: "Produção",
      rotulo: "Entregues",
      valor: formatarInteiro(a.entregues),
      sub: `de ${formatarInteiro(a.totalCtrcs)} emitidos`,
      tom: "neutro",
      comparativo: cmp(
        (b) => formatarInteiro(b.entregues),
        (b) => deltaPctAbs(a.entregues, b.entregues, true),
      ),
    },
    {
      secao: "Produção",
      rotulo: "Finalizado em Sistema",
      valor: formatarInteiro(a.finalizadoSistema),
      sub: "CTRCs baixados sem entrega (12/36/61/77/92/93/94/99)",
      dica: "CTRCs finalizados no sistema por códigos de baixa administrativa",
      tom: "neutro",
      comparativo: cmp(
        (b) => formatarInteiro(b.finalizadoSistema),
        (b) => deltaPctAbs(a.finalizadoSistema, b.finalizadoSistema, false),
      ),
    },
    {
      secao: "Produção",
      rotulo: "% Produção",
      valor: formatarPercentual(d.pctProducao, { escala: "cem" }),
      sub: `${formatarInteiro(a.entregues)} / ${formatarInteiro(a.totalCtrcs)} entregues no período`,
      dica: "Percentual de CT-e emitidos no período que já foram entregues",
      tom: "neutro",
      comparativo: cmpDerivado("pctProducao", true),
    },
    {
      secao: "Qualidade",
      rotulo: "% No prazo",
      valor: formatarPercentual(d.pctNoPrazo, { escala: "cem" }),
      legenda: "Entregues até a data combinada",
      sub: `${formatarInteiro(a.noPrazo)} de ${formatarInteiro(d.totalPrazo)} com prazo`,
      tom: d.pctNoPrazo != null && d.pctNoPrazo >= meta ? "bom" : "neutro",
      comparativo: cmpDerivado("pctNoPrazo", true),
    },
    {
      secao: "Qualidade",
      rotulo: "% Penalizado Pont.",
      valor: formatarPercentual(d.pctPenalizadoOp, { escala: "cem" }),
      sub: "ocorrências penalizantes",
      dica: "Percentual de CTRCs com ocorrência penalizante (exclui responsabilidade do cliente)",
      tom: d.pctPenalizadoOp != null && d.pctPenalizadoOp > 100 - meta ? "ruim" : "neutro",
      comparativo: cmpDerivado("pctPenalizadoOp", false),
    },
    {
      secao: "Qualidade",
      rotulo: "% Penalizado Op.",
      valor: formatarPercentual(d.pctPenalizadoPont, { escala: "cem" }),
      legenda: "Entregues depois da data combinada",
      sub: `${formatarInteiro(a.foraPrazo)} fora do prazo`,
      dica: "Entregues fora do prazo sobre os CT-e emitidos (complemento do SLA Operacional)",
      tom: d.pctPenalizadoPont != null && d.pctPenalizadoPont > 100 - meta ? "ruim" : "neutro",
      comparativo: cmpDerivado("pctPenalizadoPont", false),
    },
    {
      secao: "Qualidade",
      rotulo: "SLA de Pontualidade",
      valor: formatarPercentual(a.slaOperacionalPct, { escala: "cem" }),
      sub: metaTexto,
      dica: "Baseado em ocorrências penalizantes registradas nos CTRCs.",
      tom: tomDoSla(a.slaOperacionalPct, meta),
      comparativo: cmp(
        (b) => formatarPercentual(b.slaOperacionalPct, { escala: "cem" }),
        (b) => deltaPP(a.slaOperacionalPct, b.slaOperacionalPct, true),
      ),
    },
    {
      secao: "Qualidade",
      rotulo: "SLA Cliente",
      valor: formatarPercentual(a.slaClientePct, { escala: "cem" }),
      sub:
        a.slaClientePct != null
          ? `${formatarInteiro(a.noPrazoCliente)} no prazo · ${formatarInteiro(a.foraPrazoCliente)} fora`
          : a.totalCliente === 0
            ? "Sem CTRCs de responsabilidade do cliente"
            : "Aguardando dados de pontualidade",
      dica: "Pontualidade dos CTRCs cujo atraso é de responsabilidade do cliente/parceiro — universo separado, não soma com o SLA de Pontualidade.",
      tom: tomDoSla(a.slaClientePct, meta),
      comparativo: cmp(
        (b) => formatarPercentual(b.slaClientePct, { escala: "cem" }),
        (b) => deltaPP(a.slaClientePct, b.slaClientePct, true),
      ),
    },
    {
      secao: "Qualidade",
      rotulo: "SLA Operacional",
      valor: formatarPercentual(a.slaPontualidadePct, { escala: "cem" }),
      sub: metaTexto,
      dica: "CT-e emitidos menos os entregues fora do prazo, sobre os CT-e emitidos. Fora do prazo exclui responsabilidade do cliente.",
      tom: a.slaPontualidadePct != null && a.slaPontualidadePct >= meta ? "bom" : "neutro",
      comparativo: cmp(
        (b) => formatarPercentual(b.slaPontualidadePct, { escala: "cem" }),
        (b) => deltaPP(a.slaPontualidadePct, b.slaPontualidadePct, true),
      ),
    },
    {
      secao: "Qualidade",
      rotulo: "Prejuízo",
      valor: formatarMoeda(a.valorFretePerdido),
      sub: `${subtituloDoPrejuizo(codigosDoFiltro)} · ${formatarPercentual(a.pctFretePerdido, { escala: "cem" })} de ${formatarMoeda(a.valorFreteTotal)} (romaneados)`,
      dica: "Valor de frete de CTRCs romaneados (com ocorrência 85) cuja ocorrência penalizante é o(s) código(s) indicado(s), sobre o valor total de romaneados no período",
      tom: "ruim",
      comparativo: cmp(
        (b) => formatarMoeda(b.valorFretePerdido),
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
    valor: `${formatarInteiro(u.total)} emitidos · SLA Pont. ${formatarPercentual(u.slaOperacionalPct, { escala: "cem" })} · SLA Op. ${formatarPercentual(u.slaPontualidadePct, { escala: "cem" })}`,
    comparativo: comparadas.has(u.sigla)
      ? `SLA Pont. ${formatarPercentual(comparadas.get(u.sigla)?.slaOperacionalPct ?? null, { escala: "cem" })}`
      : "",
  }));
  return [...indicadores, ...unidades];
}

/**
 * Aba "SLA por unidade" do Excel do relatório, com as colunas de hoje (comparativo: pares P/C e
 * "Status (P)"). Status pelo SLA de Pontualidade (`slaOperacionalPct`) contra a meta.
 * origem: unidadesRows (relatorio-semanal-export.ts, sistema atual)
 */
export function abaSlaPorUnidade(r: RelatorioPeriodo): AbaExcel {
  const cmp = r.comparativo;
  const meta = r.limites.slaMetaPct;
  const comparadas = new Map((cmp?.porUnidade ?? []).map((u) => [u.sigla, u]));
  const pct = (v: number | null) => formatarPercentual(v, { escala: "cem" });
  const fixas: ColunaExportacao[] = [
    { chave: "unidade", titulo: "Unidade" },
    { chave: "cidadeUf", titulo: "Cidade/UF" },
  ];
  const colunas: ColunaExportacao[] = cmp
    ? [
        ...fixas,
        { chave: "emitidos", titulo: "Emitidos (P)", formato: "inteiro" },
        { chave: "emitidosC", titulo: "Emitidos (C)", formato: "inteiro" },
        { chave: "entregues", titulo: "Entregues (P)", formato: "inteiro" },
        { chave: "entreguesC", titulo: "Entregues (C)", formato: "inteiro" },
        { chave: "producao", titulo: "% Produção (P)" },
        { chave: "producaoC", titulo: "% Produção (C)" },
        { chave: "slaPont", titulo: "SLA Pont. (P)" },
        { chave: "slaPontC", titulo: "SLA Pont. (C)" },
        { chave: "slaOp", titulo: "SLA Op. (P)" },
        { chave: "slaOpC", titulo: "SLA Op. (C)" },
        { chave: "status", titulo: "Status (P)" },
      ]
    : [
        ...fixas,
        { chave: "emitidos", titulo: "Emitidos", formato: "inteiro" },
        { chave: "entregues", titulo: "Entregues", formato: "inteiro" },
        { chave: "producao", titulo: "% Produção" },
        { chave: "slaPont", titulo: "SLA de Pontualidade" },
        { chave: "slaOp", titulo: "SLA Operacional" },
        { chave: "status", titulo: "Status" },
      ];
  const linhas = r.porUnidade.map((u) => {
    // Unidade sem movimento no comparativo: célula vazia, como hoje.
    const c = comparadas.get(u.sigla);
    return {
      unidade: u.sigla,
      cidadeUf: u.cidade ? `${u.cidade}${u.uf ? `/${u.uf}` : ""}` : "",
      emitidos: u.total,
      emitidosC: c?.total ?? "",
      entregues: u.entregues,
      entreguesC: c?.entregues ?? "",
      producao: pct(u.producaoPct),
      producaoC: c ? pct(c.producaoPct) : "",
      slaPont: pct(u.slaOperacionalPct),
      slaPontC: c ? pct(c.slaOperacionalPct) : "",
      slaOp: pct(u.slaPontualidadePct),
      slaOpC: c ? pct(c.slaPontualidadePct) : "",
      status: statusDaUnidade(u.slaOperacionalPct, meta),
    };
  });
  return { nome: "SLA por unidade", titulo: "SLA por unidade", colunas, linhas };
}
