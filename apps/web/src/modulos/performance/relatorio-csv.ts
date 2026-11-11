import { derivadosDoBloco, subtituloDoPrejuizo } from "@erp/dominio/performance/relatorio";
import { type RelatorioPeriodo } from "@erp/shared/contratos/performance";

import { type LinhaCsvEmSecoes } from "@/lib/exportacao";

import { etiquetasDoRelatorio, type FiltrosDoRelatorio } from "./relatorio";

/**
 * CSV do relatório de período em seções, como hoje: cabeçalho `# ...`, indicadores globais do
 * período principal, Previstos no modo do painel, Finalizado em Sistema (só com linhas) e SLA por
 * unidade (pares P/C no comparativo). Percentuais com 2 casas e vírgula, nulo vazio; SLA
 * Operacional e SLA Cliente em 0–100 (Q01). origem: exportCsv (RelatorioPeriodoPanel.tsx)
 */

const decimal = (v: number) => v.toFixed(2).replace(".", ",");
const pct = (v: number | null) => (v == null ? "" : decimal(v));

export function csvDoRelatorio(
  r: RelatorioPeriodo,
  modoPrevistos: "todos" | "periodo",
  filtros: FiltrosDoRelatorio,
): { arquivo: string; linhas: LinhaCsvEmSecoes[] } {
  const cmp = r.comparativo;
  const a = r.atual;
  const d = derivadosDoBloco(a);
  const etiquetas = etiquetasDoRelatorio(filtros);
  const linhas: LinhaCsvEmSecoes[] = [
    `# Relatório de período · ${r.periodo.inicio} → ${r.periodo.fim}`,
  ];
  if (cmp) linhas.push(`# Comparativo · ${cmp.periodo.inicio} → ${cmp.periodo.fim}`);
  if (etiquetas.length > 0)
    linhas.push(
      `# Filtros herdados: ${etiquetas.map((e) => `${e.rotulo}=${e.valor}`).join(" | ")}`,
    );

  linhas.push("", "# Indicadores globais", ["Indicador", "Valor"]);
  linhas.push(
    ["CT-e emitidos", a.totalCtrcs],
    ["Entregues", a.entregues],
    ["Finalizado em Sistema", a.finalizadoSistema],
    ["% Produção", pct(d.pctProducao)],
    ["No prazo", a.noPrazo],
    ["Fora do prazo", a.foraPrazo],
    ["SLA de Pontualidade", pct(a.slaOperacionalPct)],
    ["SLA Operacional", pct(a.slaPontualidadePct)],
    ["SLA Cliente", pct(a.slaClientePct)],
    ["Taxa de retorno", pct(a.taxaRetornoPct)],
    ["Penalizantes (ocorrências)", r.penalizantes.ocorrencias],
    ["Penalizantes (CTRCs afetados)", r.penalizantes.ctrcsAfetados],
    [`Prejuízo (R$) — ${subtituloDoPrejuizo(filtros.codigos)}`, decimal(a.valorFretePerdido)],
    ["Prejuízo (%)", pct(a.pctFretePerdido)],
  );

  const prev = modoPrevistos === "todos" ? r.previstosTodos : r.previstosPeriodo;
  linhas.push(
    "",
    `# Previstos (${modoPrevistos === "todos" ? "Todos em aberto" : "Emitidos no período"})`,
    ["Eixo", "Chave", "Qtd", "Peso (kg)", "Volumes", "Frete (R$)"],
    ...prev.status.map((b) => ["Status", b.key, b.qtd, b.peso, b.volumes, decimal(b.frete)]),
    ...prev.faixa.map((b) => ["Vencimento", b.key, b.qtd, b.peso, b.volumes, decimal(b.frete)]),
  );

  if (r.finalizadoPorCodigo.length > 0)
    linhas.push(
      "",
      "# Finalizado em Sistema por código",
      ["Código", "Descrição", "Qtd"],
      ...r.finalizadoPorCodigo.map((f) => [f.codigo, f.descricao ?? "—", f.qtd]),
    );

  const comparadas = new Map((cmp?.porUnidade ?? []).map((u) => [u.sigla, u]));
  const par = (principal: string, comparativo: string) =>
    cmp ? [`${principal} (P)`, `${principal} (C)`] : [comparativo];
  linhas.push("", "# SLA por unidade", [
    "Unidade",
    "Cidade",
    "UF",
    ...par("Emitidos", "Emitidos"),
    ...par("Entregues", "Entregues"),
    ...par("% Produção", "% Produção"),
    ...par("SLA Pont.", "SLA Pont. (%)"),
    ...par("SLA Op.", "SLA Op. (%)"),
  ]);
  for (const u of r.porUnidade) {
    const c = comparadas.get(u.sigla);
    // Unidade sem movimento no comparativo: célula vazia, como hoje.
    const com = (principal: string | number, comparado: string | number | undefined) =>
      cmp ? [principal, comparado ?? ""] : [principal];
    linhas.push([
      u.sigla,
      u.cidade ?? "",
      u.uf ?? "",
      ...com(u.total, c?.total),
      ...com(u.entregues, c?.entregues),
      ...com(pct(u.producaoPct), c && pct(c.producaoPct)),
      ...com(pct(u.slaOperacionalPct), c && pct(c.slaOperacionalPct)),
      ...com(pct(u.slaPontualidadePct), c && pct(c.slaPontualidadePct)),
    ]);
  }

  return { arquivo: `relatorio-periodo-${r.periodo.inicio}_${r.periodo.fim}`, linhas };
}
