import { compararTexto } from "@erp/dominio/performance/primitivas";
import {
  type Delta,
  deltaPctAbs,
  deltaPP,
  derivadosDoBloco,
  subtituloDoPrejuizo,
} from "@erp/dominio/performance/relatorio";
import { ordenarUnidades } from "@erp/dominio/performance/tela";
import {
  type Alertas,
  type BlocoProducao,
  type RelatorioPeriodo,
  type UnidadePontualidade,
  type UnidadeResumo,
} from "@erp/shared/contratos/performance";
import { formatarInteiro, formatarMoeda, formatarPercentual } from "@erp/shared/formatacao";

import { type BuscaPerformance, type ExtraDaLista, type TipoDaLista } from "./busca";

export type IconeDoAlerta =
  | "abaixo"
  | "parado"
  | "queda"
  | "vencendo"
  | "nascido"
  | "finalizados"
  | "semAtualizacao"
  | "oc13"
  | "oc13Multipla";

export interface CartaoDeAlerta {
  chave: IconeDoAlerta;
  cor: string;
  titulo: string;
  subtitulo: string;
  explicacao: string;
  lista: TipoDaLista;
  unidades?: string[] | undefined;
}

const RUIM = "var(--status-bad)";
const ATENCAO = "var(--status-warn)";
const pct1 = (fracao: number) => formatarPercentual(fracao);
const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);
const top = (itens: { unidade: string; qtd: number }[]) =>
  itens
    .slice(0, 2)
    .map((u) => `${u.unidade} (${u.qtd})`)
    .join(" · ");

/**
 * Cartões do banner "Alertas operacionais" (só os que dispararam, na ordem de hoje).
 * origem: AlertsBanner.tsx (sistema atual)
 */
export function cartoesDeAlerta(
  d: Alertas,
  slaOpPorUnidade: readonly Pick<UnidadePontualidade, "sigla" | "performancePct">[],
  nomeCurto: string,
): CartaoDeAlerta[] {
  const l = d.limites;
  const abaixo = slaOpPorUnidade
    .filter((u) => u.performancePct != null && u.performancePct * 100 < l.vermelhoPct)
    .sort(
      (a, b) =>
        (a.performancePct ?? 0) - (b.performancePct ?? 0) || compararTexto(a.sigla, b.sigla),
    );
  const piores = abaixo.slice(0, 4);
  const queda = d.quedaSla.items.slice(0, 2);
  const fin = d.finSistemaAnomalo.items.slice(0, 2);
  const venc = d.vencendo.topParceiros.slice(0, 2);
  const unica = (itens: { unidade: string }[]) =>
    itens.length === 1 && itens[0] ? [itens[0].unidade] : undefined;

  const cartoes: (CartaoDeAlerta | false)[] = [
    abaixo.length > 0 && {
      chave: "abaixo",
      cor: RUIM,
      titulo: `${abaixo.length} ${plural(abaixo.length, "unidade abaixo", "unidades abaixo")} da meta`,
      subtitulo:
        piores.length > 0
          ? `Piores: ${piores.map((u) => `${u.sigla} (${pct1(u.performancePct ?? 0)})`).join(" · ")}`
          : `SLA Op. < ${l.vermelhoPct}%`,
      explicacao: `Unidades com SLA Operacional abaixo da meta (${l.vermelhoPct}%) no período — o mesmo SLA Op. da tabela Performance por unidade (entrega comparada com a data prevista; exclui responsabilidade do cliente), por data de emissão. O clique abre os CT-e dessas unidades ainda em aberto com ocorrência penalizante.`,
      lista: "penalizados_abertos",
      unidades: abaixo.map((u) => u.sigla),
    },
    d.semMovimento.count > 0 && {
      chave: "parado",
      cor: ATENCAO,
      titulo: `${d.semMovimento.count} ${plural(d.semMovimento.count, "CTRC atrasado e parado", "CTRCs atrasados e parados")} há mais de ${l.diasSemMovimento} dias`,
      subtitulo: `atraso > ${l.diasSemMovimento} dias e sem movimento no SSW há > ${l.diasSemMovimento} dias`,
      explicacao: `CTRCs em aberto que atendem às duas condições: atraso confirmado pelo SSW (relatório 0013) superior a ${l.diasSemMovimento} dias E nenhuma movimentação no SSW nesse mesmo intervalo. Exclui responsabilidade do cliente. Atrasados que continuam se movimentando não entram aqui — eles aparecem no card Em Atraso.`,
      lista: "sem_movimento",
    },
    d.quedaSla.count > 0 && {
      chave: "queda",
      cor: RUIM,
      titulo: `${d.quedaSla.count} ${plural(d.quedaSla.count, "unidade com queda", "unidades com queda")} de SLA`,
      subtitulo:
        queda.length > 0
          ? queda.map((q) => `${q.unidade} (-${q.quedaPp}pp)`).join(" · ")
          : `queda ≥ ${l.quedaSlaPp}pp vs ${l.janelaTendenciaDias}d anteriores`,
      explicacao: `Compara o SLA de Pontualidade (${nomeCurto}) dos últimos ${l.janelaTendenciaDias} dias com os ${l.janelaTendenciaDias} dias anteriores. Dispara quando a queda ≥ ${l.quedaSlaPp} p.p. e o volume mínimo é 10 CTRCs.`,
      lista: "penalizados",
      unidades: unica(queda),
    },
    d.vencendo.count >= l.minVencimento && {
      chave: "vencendo",
      cor: ATENCAO,
      titulo: `${d.vencendo.count} CTRCs vencendo em ${l.janelaVencimentoH}h`,
      subtitulo:
        venc.length > 0
          ? `Top: ${venc.map((p) => `${p.parceiroNome ?? "—"} (${p.qtd})`).join(" · ")}`
          : "previsão de entrega próxima",
      explicacao: `CTRCs em aberto (${nomeCurto}) com data prevista de entrega de hoje até ${l.janelaVencimentoH} horas à frente, contando por dia. Olha todos os CTRCs em aberto, de qualquer data de emissão — não segue o período selecionado. Alerta ativa a partir de ${l.minVencimento} CTRCs.`,
      lista: "vencimento_proximo",
    },
    d.nascidoAtrasado.count >= l.nascidoAtrasadoMin && {
      chave: "nascido",
      cor: RUIM,
      titulo: `${d.nascidoAtrasado.count} CTRCs saíram para entrega com prazo vencido`,
      subtitulo:
        d.nascidoAtrasado.topUnidades.length > 0
          ? `Top: ${top(d.nascidoAtrasado.topUnidades)}`
          : "saída para entrega (85) depois da previsão",
      explicacao: `CTRCs emitidos no período cuja primeira saída para entrega (ocorrência 85) aconteceu depois da data prevista de entrega — a carga saiu para a rua com o prazo já estourado. Saída da unidade (82) é transferência e não conta. Só os ainda em aberto: CT-e com ocorrência 01, 12, 36, 59, 61, 77, 92, 93, 94 ou 99 não entram. A lista abre com o filtro Ocorrência marcando só os em aberto; limpe o filtro para ver também os finalizados. Alerta ativa a partir de ${l.nascidoAtrasadoMin} CTRC(s) no período.`,
      lista: "nascido_atrasado",
    },
    d.finSistemaAnomalo.count > 0 && {
      chave: "finalizados",
      cor: ATENCAO,
      titulo: `${d.finSistemaAnomalo.count} ${plural(d.finSistemaAnomalo.count, "unidade com", "unidades com")} anomalia de finalizados`,
      subtitulo:
        fin.length > 0
          ? fin.map((f) => `${f.unidade} (+${f.desvioPp}pp)`).join(" · ")
          : `desvio ≥ ${l.desvioFinsistemaPp}pp vs baseline`,
      explicacao: `Volume anormal de baixas em sistema sem entrega (devoluções/cancelamentos) por unidade vs baseline das 4 semanas anteriores ao período. Dispara com desvio ≥ ${l.desvioFinsistemaPp} p.p.`,
      lista: "finalizado_sistema",
      unidades: unica(fin),
    },
    d.semAtualizacao.count > 0 && {
      chave: "semAtualizacao",
      cor: ATENCAO,
      titulo: `${d.semAtualizacao.count} CTRCs sem atualização há ${l.diasSemAtualizacao}+ dias`,
      subtitulo:
        d.semAtualizacao.topUnidades.length > 0
          ? `Top: ${top(d.semAtualizacao.topUnidades)}`
          : `última ocorrência há ${l.diasSemAtualizacao} dias ou mais`,
      explicacao: `CTRCs em aberto (${nomeCurto}) cuja última ocorrência efetiva (BI2/webhook) tem ${l.diasSemAtualizacao} dias ou mais, estejam atrasados ou não. Entregues (01, 18, 67) e baixados sem entrega (12, 36, 61, 77, 92, 93, 94, 99) não entram. Olha todos os CTRCs em aberto, de qualquer data de emissão — não segue o período selecionado.`,
      lista: "sem_atualizacao",
    },
    d.ocorrencia13.count > 0 && {
      chave: "oc13",
      cor: ATENCAO,
      titulo: `${d.ocorrencia13.count} CT-e com entrega prejudicada (13)`,
      subtitulo:
        d.ocorrencia13.topUnidades.length > 0
          ? `Top: ${top(d.ocorrencia13.topUnidades)}`
          : "horário/trânsito impediram a entrega",
      explicacao:
        "CT-e emitidos no período com pelo menos uma ocorrência 13 (Entrega prejudicada pelo horário/trânsito), em qualquer data. Cada CT-e conta uma vez, mesmo com várias ocorrências 13.",
      lista: "ocorrencia_13",
    },
    d.ocorrencia13Multipla.count > 0 && {
      chave: "oc13Multipla",
      cor: RUIM,
      titulo: `${d.ocorrencia13Multipla.count} CT-e com múltiplas entregas prejudicadas (13)`,
      subtitulo:
        d.ocorrencia13Multipla.topUnidades.length > 0
          ? `Top: ${top(d.ocorrencia13Multipla.topUnidades)}`
          : "2 ou mais tentativas, ainda em aberto",
      explicacao:
        "CT-e com 2 ou mais tentativas prejudicadas por horário/trânsito, ainda em aberto (nem entregues nem baixados) — requer ação. Contam todas as ocorrências 13 do CT-e; o CT-e entra no período pela data de emissão.",
      lista: "ocorrencia_13_multipla",
    },
  ];
  return cartoes.filter((c): c is CartaoDeAlerta => c !== false);
}

/** Filtros extras da lista ao clicar num cartão de alerta (sempre pela data de emissão). */
export function extraDoAlerta(c: CartaoDeAlerta): ExtraDaLista {
  return {
    ...(c.unidades ? { unidades: c.unidades } : {}),
    ...(c.lista === "vencimento_proximo" || c.lista === "sem_atualizacao"
      ? { ignorarPeriodo: true }
      : {}),
    ...(c.lista === "nascido_atrasado" ? { abertos: true } : {}),
    base: "emissao",
  };
}

/** Linhas da tabela de unidades: ordenadas pelo SLA Op. e com o SLA Op. e os nascidos de cada uma. */
export function linhasDasUnidades(
  porUnidade: readonly UnidadeResumo[],
  slaPorSigla: ReadonlyMap<string, UnidadePontualidade>,
  ordem: BuscaPerformance["ordem"],
) {
  return ordenarUnidades(
    porUnidade,
    new Map([...slaPorSigla].map(([s, u]) => [s, u.performancePct])),
    ordem,
  ).map((u) => ({
    ...u,
    slaOp: slaPorSigla.get(u.sigla)?.performancePct ?? null,
    nascidosPct: slaPorSigla.get(u.sigla)?.nascidosPct ?? null,
  }));
}

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
