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
import { lerFiltroTexto } from "@erp/shared/filtro-texto";
import {
  formatarData,
  formatarInteiro,
  formatarMoeda,
  formatarPercentual,
} from "@erp/shared/formatacao";

import { type AbaExcel, type ColunaExportacao, type OpcoesExcel } from "@/lib/exportacao";

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

/**
 * Filtros herdados da tela, por extenso, para as etiquetas do relatório, o CSV, a impressão e as
 * notas da aba "Resumo". Unidade ou parceiro sem nome conhecido fica de fora, como hoje.
 */
export interface FiltrosDoRelatorio {
  unidades: readonly string[];
  parceiros: readonly string[];
  remetente: string;
  destino: string;
  filiais: readonly string[];
  codigos: readonly string[];
}

/** Nomes conhecidos dos ids selecionados; o que não tem nome é omitido (como hoje). */
export function nomesConhecidos(
  ids: readonly string[],
  opcoes: readonly { id: string; nome: string }[] | undefined,
): string[] {
  return ids.flatMap((id) => {
    const nome = opcoes?.find((o) => o.id === id)?.nome;
    return nome ? [nome] : [];
  });
}

const ateTres = (lista: readonly string[]) =>
  lista.slice(0, 3).join(", ") + (lista.length > 3 ? ` +${String(lista.length - 3)}` : "");

/**
 * Etiquetas "Filtros herdados da barra principal" do relatório (e do CSV e da impressão).
 * origem: buildChips (RelatorioPeriodoPanel.tsx, sistema atual)
 */
export function etiquetasDoRelatorio(f: FiltrosDoRelatorio): { rotulo: string; valor: string }[] {
  const etiquetas: { rotulo: string; valor: string }[] = [];
  if (f.unidades.length > 0) etiquetas.push({ rotulo: "Unidades", valor: ateTres(f.unidades) });
  if (f.parceiros.length > 0) etiquetas.push({ rotulo: "Parceiros", valor: ateTres(f.parceiros) });
  if (f.remetente)
    etiquetas.push({ rotulo: "Remetente", valor: lerFiltroTexto(f.remetente).join(" · ") });
  if (f.destino)
    etiquetas.push({ rotulo: "Destino", valor: lerFiltroTexto(f.destino).join(" · ") });
  if (f.filiais.length > 0) etiquetas.push({ rotulo: "Filiais", valor: f.filiais.join(", ") });
  if (f.codigos.length > 0) etiquetas.push({ rotulo: "Ocorrências", valor: ateTres(f.codigos) });
  return etiquetas;
}

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
