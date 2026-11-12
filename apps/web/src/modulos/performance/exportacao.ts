import {
  type Delta,
  deltaPctAbs,
  deltaPP,
  derivadosDoBloco,
  statusDaUnidade,
  subtituloDoPrejuizo,
} from "@erp/dominio/performance/relatorio";
import {
  type BlocoProducao,
  type Previstos,
  type RelatorioPeriodo,
} from "@erp/shared/contratos/performance";
import {
  formatarData,
  formatarInteiro,
  formatarMoeda,
  formatarPercentual,
} from "@erp/shared/formatacao";

import {
  type AbaExcel,
  type ColunaExportacao,
  escaparHtml as esc,
  type LinhaCsvEmSecoes,
  type OpcoesDocumentoImpresso,
  type OpcoesExcel,
} from "@/lib/exportacao";

import { etiquetasDoRelatorio, type FiltrosDoRelatorio } from "./textos";

/** Colunas do "Exportar" da tela: uma linha por ocorrência dos CT-e filtrados (Q13, Q18). */
export const COLUNAS_DA_EXPORTACAO: ColunaExportacao[] = [
  { chave: "numeroNf", titulo: "NF" },
  { chave: "numero", titulo: "CTRC" },
  { chave: "dataEmissao", titulo: "Data emissão", formato: "data" },
  { chave: "unidade", titulo: "Unidade" },
  { chave: "remetente", titulo: "Remetente" },
  { chave: "destinatario", titulo: "Destinatário" },
  { chave: "cidadeDestino", titulo: "Cidade destino" },
  { chave: "peso", titulo: "Peso (kg)", formato: "decimal" },
  { chave: "volumes", titulo: "Volumes", formato: "inteiro" },
  { chave: "valorFrete", titulo: "Frete (R$)", formato: "moeda" },
  { chave: "placaRomaneio", titulo: "Placa (romaneio)" },
  { chave: "motorista", titulo: "Motorista" },
  { chave: "placaColeta", titulo: "Placa coleta" },
  { chave: "placaEntrega", titulo: "Placa entrega" },
  { chave: "cteVinculo", titulo: "CT-e vínculo" },
  { chave: "romaneio", titulo: "Romaneio" },
  { chave: "codigo", titulo: "Código" },
  { chave: "descricao", titulo: "Descrição" },
  { chave: "dataHora", titulo: "Data/hora ocorrência", formato: "datahora" },
  { chave: "status", titulo: "Status" },
];

// ---------------------------------------------------------------- Relatório de período: Excel

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

// ---------------------------------------------------------------- Excel (como o atual)
// origem: exportRelatorioXlsx (relatorio-semanal-export.ts, sistema atual). Números saem crus
// (sem formato de coluna) e percentuais como texto "x,x%" / "—", como hoje.

const pctTexto = (v: number | null) => formatarPercentual(v, { escala: "cem" });

/** Notas "Filtros aplicados:" da aba "Resumo" (vazia sem filtro). origem: filtrosLines */
export function notasDosFiltros(f: FiltrosDoRelatorio): string[] {
  const partes: string[] = [];
  if (f.unidades.length > 0) partes.push(`Unidades: ${f.unidades.join(", ")}`);
  if (f.parceiros.length > 0) partes.push(`Parceiros: ${f.parceiros.join(", ")}`);
  if (f.remetente.trim()) partes.push(`Remetente: ${f.remetente.trim()}`);
  if (f.destino.trim()) partes.push(`Destino: ${f.destino.trim()}`);
  if (f.filiais.length > 0) partes.push(`Filiais: ${f.filiais.join(", ")}`);
  if (f.codigos.length > 0) partes.push(`Códigos: ${f.codigos.join(", ")}`);
  return partes.length > 0 ? ["Filtros aplicados:", ...partes.map((p) => `• ${p}`)] : [];
}

/** Subtítulo de todas as abas. origem: subtituloPeriodo */
export function subtituloDoExcel(r: RelatorioPeriodo): string {
  const principal = `Período: ${formatarData(r.periodo.inicio)} a ${formatarData(r.periodo.fim)}`;
  const c = r.comparativo;
  return c
    ? `${principal} · comparativo: ${formatarData(c.periodo.inicio)} a ${formatarData(c.periodo.fim)}`
    : principal;
}

/** Indicadores da aba "Resumo", na ordem e com os rótulos de hoje. origem: blocoIndicadores */
function indicadoresDoResumo(
  a: BlocoProducao,
  codigosDoFiltro: readonly string[],
): { rotulo: string; valor: string | number }[] {
  const d = derivadosDoBloco(a);
  return [
    { rotulo: "CT-e emitidos", valor: a.totalCtrcs },
    { rotulo: "Entregues", valor: a.entregues },
    { rotulo: "Finalizado em Sistema", valor: a.finalizadoSistema },
    { rotulo: "% Produção (entregues/emitidos)", valor: pctTexto(d.pctProducao) },
    { rotulo: "No prazo", valor: a.noPrazo },
    { rotulo: "Fora do prazo", valor: a.foraPrazo },
    { rotulo: "% No prazo", valor: pctTexto(d.pctNoPrazo) },
    { rotulo: "% Penalizado Pontualidade", valor: pctTexto(d.pctPenalizadoOp) },
    { rotulo: "% Penalizado Operacional", valor: pctTexto(d.pctPenalizadoPont) },
    { rotulo: "Pendentes de prazo", valor: a.pendentePrazo },
    { rotulo: "Sem prazo definido", valor: a.semPrazo },
    { rotulo: "SLA de Pontualidade", valor: pctTexto(a.slaOperacionalPct) },
    { rotulo: "SLA Operacional", valor: pctTexto(a.slaPontualidadePct) },
    { rotulo: "SLA Cliente", valor: pctTexto(a.slaClientePct) },
    { rotulo: "SLA Cliente — no prazo", valor: a.noPrazoCliente },
    { rotulo: "SLA Cliente — fora do prazo", valor: a.foraPrazoCliente },
    { rotulo: "SLA Cliente — total (universo)", valor: a.totalCliente },
    { rotulo: "Taxa de retorno (código 13)", valor: pctTexto(a.taxaRetornoPct) },
    { rotulo: "Valor de frete romaneado", valor: formatarMoeda(a.valorFreteTotal) },
    {
      rotulo: `Prejuízo (R$) — ${subtituloDoPrejuizo(codigosDoFiltro)}`,
      valor: formatarMoeda(a.valorFretePerdido),
    },
    { rotulo: "Prejuízo (% dos romaneados)", valor: pctTexto(a.pctFretePerdido) },
  ];
}

/** Aba "Resumo": `Indicador | Valor` (comparativo: períodos principal e comparativo). */
export function tabelaDoResumo(
  r: RelatorioPeriodo,
  codigosDoFiltro: readonly string[],
): Pick<OpcoesExcel, "colunas" | "linhas"> {
  const c = r.comparativo;
  const principal = indicadoresDoResumo(r.atual, codigosDoFiltro);
  const comparado = c ? indicadoresDoResumo(c.atual, codigosDoFiltro) : [];
  const linhas = [
    ...principal.map((i, n) => ({
      indicador: i.rotulo,
      valor: i.valor,
      comparativo: comparado[n]?.valor ?? "",
    })),
    {
      indicador: "Penalizantes — ocorrências",
      valor: r.penalizantes.ocorrencias,
      comparativo: c?.penalizantes.ocorrencias ?? "",
    },
    {
      indicador: "Penalizantes — CTRCs afetados",
      valor: r.penalizantes.ctrcsAfetados,
      comparativo: c?.penalizantes.ctrcsAfetados ?? "",
    },
  ];
  const colunas: ColunaExportacao[] = c
    ? [
        { chave: "indicador", titulo: "Indicador" },
        { chave: "valor", titulo: "Período principal" },
        { chave: "comparativo", titulo: "Período comparativo" },
      ]
    : [
        { chave: "indicador", titulo: "Indicador" },
        { chave: "valor", titulo: "Valor" },
      ];
  return { colunas, linhas };
}

type FaixaDosPrevistos = Previstos["status"][number] | Previstos["faixa"][number];

/** Abas "Previstos (todos)" e "Previstos (período)": status e faixa de vencimento, crus. */
function abaDePrevistos(nome: string, titulo: string, p: Previstos): AbaExcel {
  const linha = (eixo: string) => (b: FaixaDosPrevistos) => ({
    eixo,
    chave: b.key,
    qtd: b.qtd,
    peso: b.peso,
    volumes: b.volumes,
    frete: b.frete,
  });
  return {
    nome,
    titulo,
    // Quantidade e peso crus no total, como hoje.
    notas: [
      `Total: ${String(p.total.qtd)} CTRCs · Peso: ${String(p.total.peso)} kg · Frete: ${formatarMoeda(p.total.frete)}`,
    ],
    colunas: [
      { chave: "eixo", titulo: "Eixo" },
      { chave: "chave", titulo: "Chave" },
      { chave: "qtd", titulo: "Qtd" },
      { chave: "peso", titulo: "Peso (kg)" },
      { chave: "volumes", titulo: "Volumes" },
      { chave: "frete", titulo: "Frete (R$)" },
    ],
    linhas: [...p.status.map(linha("Status")), ...p.faixa.map(linha("Vencimento"))],
  };
}

/** Aba "Finalizado em Sistema" (só com linhas). */
function abaFinalizadoEmSistema(r: RelatorioPeriodo): AbaExcel | null {
  if (r.finalizadoPorCodigo.length === 0) return null;
  return {
    nome: "Finalizado em Sistema",
    titulo: "Finalizado em Sistema",
    colunas: [
      { chave: "codigo", titulo: "Código" },
      { chave: "descricao", titulo: "Descrição" },
      { chave: "qtd", titulo: "Qtd" },
    ],
    linhas: r.finalizadoPorCodigo.map((f) => ({
      codigo: f.codigo,
      descricao: f.descricao ?? "—",
      qtd: f.qtd,
    })),
  };
}

/** Aba "Impacto por código" (só com linhas; comparativo em pares P/C). origem: impactoRows */
function abaImpactoPorCodigo(r: RelatorioPeriodo): AbaExcel | null {
  if (r.impactoCodigos.length === 0) return null;
  const cmp = r.comparativo;
  const comparados = new Map((cmp?.impactoCodigos ?? []).map((i) => [i.codigo, i]));
  const fixas: ColunaExportacao[] = [
    { chave: "codigo", titulo: "Código" },
    { chave: "descricao", titulo: "Descrição" },
  ];
  const colunas: ColunaExportacao[] = cmp
    ? [
        ...fixas,
        { chave: "ctrcs", titulo: "CTRCs (P)" },
        { chave: "ctrcsC", titulo: "CTRCs (C)" },
        { chave: "pct", titulo: "% total (P)" },
        { chave: "pctC", titulo: "% total (C)" },
      ]
    : [...fixas, { chave: "ctrcs", titulo: "CTRCs" }, { chave: "pct", titulo: "% total" }];
  const linhas = r.impactoCodigos.map((i) => {
    const c = comparados.get(i.codigo);
    return {
      codigo: i.codigo,
      descricao: i.descricao ?? "—",
      ctrcs: i.totalCtrcs,
      ctrcsC: c?.totalCtrcs ?? "",
      pct: pctTexto(i.pctDoTotal),
      pctC: c ? pctTexto(c.pctDoTotal) : "",
    };
  });
  return { nome: "Impacto por código", titulo: "Impacto por código", colunas, linhas };
}

/**
 * Excel do relatório de período, aba por aba como hoje: Resumo, SLA por unidade, Previstos
 * (todos), Previstos (período), Finalizado em Sistema e Impacto por código (as duas últimas só
 * com linhas). Arquivo `relatorio-periodo-AAAA-MM-DD-AAAA-MM-DD.xlsx`.
 */
export function excelDoRelatorio(
  r: RelatorioPeriodo,
  codigosDoFiltro: readonly string[],
  filtros: FiltrosDoRelatorio,
): Omit<OpcoesExcel, "empresa"> {
  const opcionais = [abaFinalizadoEmSistema(r), abaImpactoPorCodigo(r)].filter(
    (a): a is AbaExcel => a !== null,
  );
  return {
    arquivo: `relatorio-periodo-${r.periodo.inicio}-${r.periodo.fim}`,
    titulo: "Relatório de período",
    subtitulo: subtituloDoExcel(r),
    nomeDaAba: "Resumo",
    notas: notasDosFiltros(filtros),
    ...tabelaDoResumo(r, codigosDoFiltro),
    abasExtras: [
      abaSlaPorUnidade(r),
      abaDePrevistos("Previstos (todos)", "Previstos — Todos em aberto", r.previstosTodos),
      abaDePrevistos("Previstos (período)", "Previstos — Emitidos no período", r.previstosPeriodo),
      ...opcionais,
    ],
  };
}

// ---------------------------------------------------------------- Relatório de período: CSV

/**
 * CSV do relatório de período em seções, como hoje: cabeçalho `# ...`, indicadores globais do
 * período principal, Previstos no modo do painel, Finalizado em Sistema (só com linhas) e SLA por
 * unidade (pares P/C no comparativo). Percentuais com 2 casas e vírgula, nulo vazio; SLA
 * Operacional e SLA Cliente em 0–100 (Q01). origem: exportCsv (RelatorioPeriodoPanel.tsx)
 */

const decimalDoCsv = (v: number) => v.toFixed(2).replace(".", ",");
const pctDoCsv = (v: number | null) => (v == null ? "" : decimalDoCsv(v));

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
    ["% Produção", pctDoCsv(d.pctProducao)],
    ["No prazo", a.noPrazo],
    ["Fora do prazo", a.foraPrazo],
    ["SLA de Pontualidade", pctDoCsv(a.slaOperacionalPct)],
    ["SLA Operacional", pctDoCsv(a.slaPontualidadePct)],
    ["SLA Cliente", pctDoCsv(a.slaClientePct)],
    ["Taxa de retorno", pctDoCsv(a.taxaRetornoPct)],
    ["Penalizantes (ocorrências)", r.penalizantes.ocorrencias],
    ["Penalizantes (CTRCs afetados)", r.penalizantes.ctrcsAfetados],
    [`Prejuízo (R$) — ${subtituloDoPrejuizo(filtros.codigos)}`, decimalDoCsv(a.valorFretePerdido)],
    ["Prejuízo (%)", pctDoCsv(a.pctFretePerdido)],
  );

  const prev = modoPrevistos === "todos" ? r.previstosTodos : r.previstosPeriodo;
  linhas.push(
    "",
    `# Previstos (${modoPrevistos === "todos" ? "Todos em aberto" : "Emitidos no período"})`,
    ["Eixo", "Chave", "Qtd", "Peso (kg)", "Volumes", "Frete (R$)"],
    ...prev.status.map((b) => ["Status", b.key, b.qtd, b.peso, b.volumes, decimalDoCsv(b.frete)]),
    ...prev.faixa.map((b) => [
      "Vencimento",
      b.key,
      b.qtd,
      b.peso,
      b.volumes,
      decimalDoCsv(b.frete),
    ]),
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
      ...com(pctDoCsv(u.producaoPct), c && pctDoCsv(c.producaoPct)),
      ...com(pctDoCsv(u.slaOperacionalPct), c && pctDoCsv(c.slaOperacionalPct)),
      ...com(pctDoCsv(u.slaPontualidadePct), c && pctDoCsv(c.slaPontualidadePct)),
    ]);
  }

  return { arquivo: `relatorio-periodo-${r.periodo.inicio}_${r.periodo.fim}`, linhas };
}

// ---------------------------------------------------------------- Relatório de período: Imprimir

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
    ${kpi("% Produção", pctTexto(d.pctProducao), `${int(a.entregues)} / ${int(a.totalCtrcs)}`, undefined, cd ? pctTexto(cd.pctProducao) : undefined, cd && deltaPP(d.pctProducao, cd.pctProducao, true))}
  </div></section>`;

  const qualidade = `<section><h4>Qualidade</h4><div class="kpi-grid-5">
    ${kpi("% No prazo", pctTexto(d.pctNoPrazo), `${int(a.noPrazo)} de ${int(d.totalPrazo)}`, d.pctNoPrazo != null && d.pctNoPrazo >= meta ? "good" : undefined, cd ? pctTexto(cd.pctNoPrazo) : undefined, cd && deltaPP(d.pctNoPrazo, cd.pctNoPrazo, true))}
    ${kpi("% Penalizado Pont.", pctTexto(d.pctPenalizadoOp), "ocorrências penalizantes", d.pctPenalizadoOp != null && d.pctPenalizadoOp > 100 - meta ? "bad" : undefined, cd ? pctTexto(cd.pctPenalizadoOp) : undefined, cd && deltaPP(d.pctPenalizadoOp, cd.pctPenalizadoOp, false))}
    ${kpi("% Penalizado Op.", pctTexto(d.pctPenalizadoPont), `${int(a.foraPrazo)} fora do prazo`, d.pctPenalizadoPont != null && d.pctPenalizadoPont > 100 - meta ? "bad" : undefined, cd ? pctTexto(cd.pctPenalizadoPont) : undefined, cd && deltaPP(d.pctPenalizadoPont, cd.pctPenalizadoPont, false))}
    ${kpi("SLA de Pontualidade", pctTexto(a.slaOperacionalPct), metaTexto, tomDoSla(a.slaOperacionalPct, meta), c && pctTexto(c.slaOperacionalPct), c && deltaPP(a.slaOperacionalPct, c.slaOperacionalPct, true))}
    ${kpi("SLA Cliente", pctTexto(a.slaClientePct), "Universo separado (responsabilidade do cliente)", tomDoSla(a.slaClientePct, meta), c && pctTexto(c.slaClientePct), c && deltaPP(a.slaClientePct, c.slaClientePct, true))}
    ${kpi("SLA Operacional", pctTexto(a.slaPontualidadePct), metaTexto, a.slaPontualidadePct != null && a.slaPontualidadePct >= meta ? "good" : undefined, c && pctTexto(c.slaPontualidadePct), c && deltaPP(a.slaPontualidadePct, c.slaPontualidadePct, true))}
    ${kpi("Prejuízo", brl(a.valorFretePerdido), `${subtituloDoPrejuizo(codigos)} · ${pctTexto(a.pctFretePerdido)} de ${brl(a.valorFreteTotal)} (romaneados)`, "bad", c && brl(c.valorFretePerdido), c && deltaPctAbs(a.valorFretePerdido, c.valorFretePerdido, false))}
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
          <td class="num">${pctTexto(u.producaoPct)}</td>${celulaC(uc && pctTexto(uc.producaoPct))}
          <td class="num ${tomDoSla(u.slaOperacionalPct, meta) ?? ""}">${pctTexto(u.slaOperacionalPct)}</td>${celulaC(uc && pctTexto(uc.slaOperacionalPct))}
          <td class="num">${pctTexto(u.slaPontualidadePct)}</td>${celulaC(uc && pctTexto(uc.slaPontualidadePct))}
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
        <td class="num">${pctTexto(i.pctDoTotal)}</td>${celulaC(ic && pctTexto(ic.pctDoTotal))}
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
