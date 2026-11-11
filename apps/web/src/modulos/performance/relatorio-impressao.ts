import {
  type Delta,
  deltaPctAbs,
  deltaPP,
  derivadosDoBloco,
  subtituloDoPrejuizo,
} from "@erp/dominio/performance/relatorio";
import { type RelatorioPeriodo } from "@erp/shared/contratos/performance";
import {
  formatarData,
  formatarInteiro,
  formatarMoeda,
  formatarPercentual,
} from "@erp/shared/formatacao";

import { escaparHtml as esc, type OpcoesDocumentoImpresso } from "@/lib/exportacao";

import { etiquetasDoRelatorio, type FiltrosDoRelatorio } from "./relatorio";

/**
 * "Imprimir" do relatório de período, como hoje: A4 retrato, cabeçalho da empresa com período,
 * comparativo e filtros; Produção, Qualidade, Previstos (modo do painel), SLA por unidade,
 * Finalizado em Sistema por código e Impacto por código (top 30). SLA em 0–100 (Q01).
 * origem: handlePrint e renderPrintBody (RelatorioPeriodoPanel.tsx, sistema atual)
 */

const ESTILOS = `
  @page { size: A4 portrait; margin: 15mm; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 10pt; line-height: 1.35; }
  .print-sub { font-size: 9pt; color: #333; margin-top: 1mm; }
  .print-filters { font-size: 8.5pt; color: #333; margin-top: 1.5mm; }
  h4 { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .06em; color: #555;
       margin: 4mm 0 2mm; font-weight: 600; }
  section { page-break-inside: avoid; margin-bottom: 3mm; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2mm; }
  .kpi-grid-5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2mm; }
  .kpi { border: 1px solid #ccc; border-radius: 2mm; padding: 2mm 2.5mm; }
  .kpi-label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .05em; color: #666; }
  .kpi-value { font-size: 12pt; font-weight: 700; margin-top: .5mm; font-variant-numeric: tabular-nums; }
  .kpi-sub { font-size: 7.5pt; color: #666; margin-top: .5mm; }
  .kpi.good .kpi-value { color: #059669; }
  .kpi.bad .kpi-value { color: #dc2626; }
  .kpi-cmp { display: flex; justify-content: space-between; align-items: baseline;
             font-size: 7.5pt; margin-top: .5mm; color: #444; }
  .kpi-cmp .cmp-val { font-variant-numeric: tabular-nums; }
  .kpi-cmp .delta { font-weight: 600; font-variant-numeric: tabular-nums; }
  .delta.good { color: #059669; }
  .delta.bad { color: #dc2626; }
  .delta.neutral { color: #666; }
  .card { border: 1px solid #ccc; border-radius: 2mm; margin-top: 3mm; }
  .card-title { padding: 2mm 3mm; border-bottom: 1px solid #ccc; font-size: 9.5pt; font-weight: 600;
                display: flex; justify-content: space-between; align-items: baseline; }
  .card-title .muted { font-size: 8pt; color: #666; font-weight: 400; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th, td { padding: 1.5mm 2mm; border-bottom: 1px solid #ddd; text-align: left; vertical-align: top; }
  th { background: var(--marca-primaria); font-size: 8pt; text-transform: uppercase; letter-spacing: .04em;
       color: #fff; font-weight: 600; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .good { color: #059669; }
  .bad { color: #dc2626; font-weight: 600; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 8.5pt; }`;

type Tom = "good" | "bad" | undefined;
const CLASSE_DO_DELTA: Record<Delta["tom"], string> = {
  bom: "good",
  ruim: "bad",
  neutro: "neutral",
};

const pct = (v: number | null) => formatarPercentual(v, { escala: "cem" });
const int = (v: number) => formatarInteiro(v);
const brl = (v: number) => formatarMoeda(v);
const CINZA = ' style="color:#666"';

function kpi(
  rotulo: string,
  valor: string,
  sub?: string,
  tom?: Tom,
  comparado?: string,
  delta?: Delta | null,
): string {
  const deltaHtml = delta
    ? `<span class="delta ${CLASSE_DO_DELTA[delta.tom]}">${esc(delta.texto)}</span>`
    : "";
  return `<div class="kpi ${tom ?? ""}">
      <div class="kpi-label">${esc(rotulo)}</div>
      <div class="kpi-value">${esc(valor)}</div>
      ${comparado != null ? `<div class="kpi-cmp"><span>vs <span class="cmp-val">${esc(comparado)}</span></span>${deltaHtml}</div>` : ""}
      ${sub ? `<div class="kpi-sub">${esc(sub)}</div>` : ""}
    </div>`;
}

/** Bom na meta, ruim abaixo de meta − 5. */
function tomDoSla(v: number | null, meta: number): Tom {
  if (v == null) return undefined;
  if (v >= meta) return "good";
  return v < meta - 5 ? "bad" : undefined;
}

function corpoDoRelatorio(
  r: RelatorioPeriodo,
  modoPrevistos: "todos" | "periodo",
  codigos: readonly string[],
): string {
  const a = r.atual;
  const meta = r.limites.slaMetaPct;
  const d = derivadosDoBloco(a);
  const cmp = r.comparativo;
  const c = cmp?.atual;
  const cd = c ? derivadosDoBloco(c) : null;
  const metaTexto = `meta ${meta.toFixed(1).replace(".", ",")}%`;

  const producao = `<section><h4>Produção</h4><div class="kpi-grid">
    ${kpi("CT-e emitidos", int(a.totalCtrcs), "Total no período", undefined, c && int(c.totalCtrcs), c && deltaPctAbs(a.totalCtrcs, c.totalCtrcs, true))}
    ${kpi("Entregues", int(a.entregues), `de ${int(a.totalCtrcs)} emitidos`, undefined, c && int(c.entregues), c && deltaPctAbs(a.entregues, c.entregues, true))}
    ${kpi("% Produção", pct(d.pctProducao), `${int(a.entregues)} / ${int(a.totalCtrcs)}`, undefined, cd ? pct(cd.pctProducao) : undefined, cd && deltaPP(d.pctProducao, cd.pctProducao, true))}
  </div></section>`;

  const qualidade = `<section><h4>Qualidade</h4><div class="kpi-grid-5">
    ${kpi("% No prazo", pct(d.pctNoPrazo), `${int(a.noPrazo)} de ${int(d.totalPrazo)}`, d.pctNoPrazo != null && d.pctNoPrazo >= meta ? "good" : undefined, cd ? pct(cd.pctNoPrazo) : undefined, cd && deltaPP(d.pctNoPrazo, cd.pctNoPrazo, true))}
    ${kpi("% Penalizado Pont.", pct(d.pctPenalizadoOp), "ocorrências penalizantes", d.pctPenalizadoOp != null && d.pctPenalizadoOp > 100 - meta ? "bad" : undefined, cd ? pct(cd.pctPenalizadoOp) : undefined, cd && deltaPP(d.pctPenalizadoOp, cd.pctPenalizadoOp, false))}
    ${kpi("% Penalizado Op.", pct(d.pctPenalizadoPont), `${int(a.foraPrazo)} fora do prazo`, d.pctPenalizadoPont != null && d.pctPenalizadoPont > 100 - meta ? "bad" : undefined, cd ? pct(cd.pctPenalizadoPont) : undefined, cd && deltaPP(d.pctPenalizadoPont, cd.pctPenalizadoPont, false))}
    ${kpi("SLA de Pontualidade", pct(a.slaOperacionalPct), metaTexto, tomDoSla(a.slaOperacionalPct, meta), c && pct(c.slaOperacionalPct), c && deltaPP(a.slaOperacionalPct, c.slaOperacionalPct, true))}
    ${kpi("SLA Cliente", pct(a.slaClientePct), "Universo separado (responsabilidade do cliente)", tomDoSla(a.slaClientePct, meta), c && pct(c.slaClientePct), c && deltaPP(a.slaClientePct, c.slaClientePct, true))}
    ${kpi("SLA Operacional", pct(a.slaPontualidadePct), metaTexto, a.slaPontualidadePct != null && a.slaPontualidadePct >= meta ? "good" : undefined, c && pct(c.slaPontualidadePct), c && deltaPP(a.slaPontualidadePct, c.slaPontualidadePct, true))}
    ${kpi("Prejuízo", brl(a.valorFretePerdido), `${subtituloDoPrejuizo(codigos)} · ${pct(a.pctFretePerdido)} de ${brl(a.valorFreteTotal)} (romaneados)`, "bad", c && brl(c.valorFretePerdido), c && deltaPctAbs(a.valorFretePerdido, c.valorFretePerdido, false))}
  </div></section>`;

  const prev = modoPrevistos === "todos" ? r.previstosTodos : r.previstosPeriodo;
  const semDados = `<tr><td colspan="3" style="text-align:center;color:#666;padding:3mm">Sem dados.</td></tr>`;
  const linhasDoEixo = (eixo: readonly { key: string; qtd: number; frete: number }[]) =>
    eixo
      .map(
        (b) =>
          `<tr><td>${esc(b.key)}</td><td class="num">${int(b.qtd)}</td><td class="num">${brl(b.frete)}</td></tr>`,
      )
      .join("") || semDados;
  const previstos = `<section><h4>Previstos · ${modoPrevistos === "todos" ? "Todos em aberto" : "Emitidos no período"}</h4>
    <div class="kpi-grid">
      ${kpi("Total previstos", int(prev.total.qtd), "CTRCs ainda não entregues")}
      ${kpi("Peso total (kg)", int(prev.total.peso))}
      ${kpi("Frete total", brl(prev.total.frete))}
    </div>
    <div class="card"><div class="card-title"><span>Por status da última ocorrência</span></div>
      <table><thead><tr><th>Status</th><th class="num">Qtd</th><th class="num">Frete (R$)</th></tr></thead>
      <tbody>${linhasDoEixo(prev.status)}</tbody></table>
    </div>
    <div class="card"><div class="card-title"><span>Por faixa de vencimento</span></div>
      <table><thead><tr><th>Faixa</th><th class="num">Qtd</th><th class="num">Frete (R$)</th></tr></thead>
      <tbody>${linhasDoEixo(prev.faixa)}</tbody></table>
    </div>
  </section>`;

  // Coluna do comparativo: cinza, "—" quando a unidade/código não aparece nele.
  const celulaC = (texto: string | undefined) =>
    cmp ? `<td class="num"${CINZA}>${texto ?? "—"}</td>` : "";
  const pSuf = cmp ? " (P)" : "";
  const cTh = cmp ? `<th class="num"${CINZA}>(C)</th>` : "";

  const unidadesC = new Map((cmp?.porUnidade ?? []).map((u) => [u.sigla, u]));
  const linhasDasUnidades =
    r.porUnidade.length === 0
      ? `<tr><td colspan="${cmp ? "11" : "6"}" style="text-align:center;color:#666;padding:4mm">Sem unidades com movimento no período.</td></tr>`
      : r.porUnidade
          .map((u) => {
            const uc = unidadesC.get(u.sigla);
            const cidade = u.cidade
              ? `<div style="font-size:7.5pt;color:#666">${esc(u.cidade)}${u.uf ? `/${esc(u.uf)}` : ""}</div>`
              : "";
            return `<tr>
          <td><strong>${esc(u.sigla)}</strong>${cidade}</td>
          <td class="num">${int(u.total)}</td>${celulaC(uc && int(uc.total))}
          <td class="num">${int(u.entregues)}</td>${celulaC(uc && int(uc.entregues))}
          <td class="num">${pct(u.producaoPct)}</td>${celulaC(uc && pct(uc.producaoPct))}
          <td class="num ${tomDoSla(u.slaOperacionalPct, meta) ?? ""}">${pct(u.slaOperacionalPct)}</td>${celulaC(uc && pct(uc.slaOperacionalPct))}
          <td class="num">${pct(u.slaPontualidadePct)}</td>${celulaC(uc && pct(uc.slaPontualidadePct))}
        </tr>`;
          })
          .join("");
  const unidades = `<div class="card">
    <div class="card-title"><span>SLA por unidade${cmp ? " · P = principal · C = comparativo" : ""}</span><span class="muted">${metaTexto}</span></div>
    <table><thead><tr>
      <th>Unidade</th>
      <th class="num">Emitidos${pSuf}</th>${cTh}
      <th class="num">Entregues${pSuf}</th>${cTh}
      <th class="num">% Produção${pSuf}</th>${cTh}
      <th class="num">SLA Pont.${pSuf}</th>${cTh}
      <th class="num">SLA Op.${pSuf}</th>${cTh}
    </tr></thead><tbody>${linhasDasUnidades}</tbody></table>
  </div>`;

  const finalizado =
    r.finalizadoPorCodigo.length === 0
      ? ""
      : `<div class="card">
    <div class="card-title"><span>Finalizado em Sistema por código</span><span class="muted">${int(a.finalizadoSistema)} CTRCs</span></div>
    <table><thead><tr><th>Código</th><th>Descrição</th><th class="num">Qtd</th></tr></thead>
      <tbody>${r.finalizadoPorCodigo.map((f) => `<tr><td class="mono">${String(f.codigo)}</td><td>${esc(f.descricao ?? "—")}</td><td class="num">${int(f.qtd)}</td></tr>`).join("")}</tbody>
    </table></div>`;

  const impactoC = new Map((cmp?.impactoCodigos ?? []).map((i) => [i.codigo, i]));
  const impacto =
    r.impactoCodigos.length === 0
      ? ""
      : `<div class="card">
    <div class="card-title"><span>Impacto por código de última ocorrência</span>
      <span class="muted">base: ${int(r.impactoBaseComOcorrencia)} CTRCs</span></div>
    <table><thead><tr>
      <th>Código</th><th>Descrição</th>
      <th class="num">CTRCs${pSuf}</th>${cTh}
      <th class="num">% do total${pSuf}</th>${cTh}
    </tr></thead><tbody>
      ${r.impactoCodigos
        .slice(0, 30)
        .map((i) => {
          const ic = impactoC.get(i.codigo);
          return `<tr>
        <td class="mono">${esc(i.codigo)}</td>
        <td class="${i.penaliza ? "bad" : ""}">${esc(i.descricao ?? "—")}</td>
        <td class="num">${int(i.totalCtrcs)}</td>${celulaC(ic && int(ic.totalCtrcs))}
        <td class="num">${pct(i.pctDoTotal)}</td>${celulaC(ic && pct(ic.pctDoTotal))}
      </tr>`;
        })
        .join("")}
    </tbody></table>
  </div>`;

  return producao + qualidade + previstos + unidades + finalizado + impacto;
}

export function impressaoDoRelatorio(
  r: RelatorioPeriodo,
  modoPrevistos: "todos" | "periodo",
  filtros: FiltrosDoRelatorio,
): Omit<OpcoesDocumentoImpresso, "empresa"> {
  const periodo = `${formatarData(r.periodo.inicio)} a ${formatarData(r.periodo.fim)}`;
  const cmp = r.comparativo;
  const etiquetas = etiquetasDoRelatorio(filtros);
  const linhaDoComparativo = cmp
    ? `<div class="print-sub"><strong>Comparativo:</strong> ${formatarData(cmp.periodo.inicio)} a ${formatarData(cmp.periodo.fim)}</div>`
    : "";
  const linhaDosFiltros =
    etiquetas.length > 0
      ? `<div class="print-filters">Filtros: ${etiquetas.map((e) => `<span><strong>${esc(e.rotulo)}:</strong> ${esc(e.valor)}</span>`).join(" · ")}</div>`
      : "";
  return {
    tituloDaJanela: `Relatório de período — ${periodo}`,
    titulo: "Relatório de Período",
    subtitulo: `Período: ${periodo}`,
    extraHtml: linhaDoComparativo + linhaDosFiltros,
    estilos: ESTILOS,
    corpoHtml: corpoDoRelatorio(r, modoPrevistos, filtros.codigos),
  };
}
