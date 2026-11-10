import { compararTexto } from "@erp/dominio/performance/primitivas";
import { type Alertas, type UnidadePontualidade } from "@erp/shared/contratos/performance";
import { formatarPercentual } from "@erp/shared/formatacao";

import { type TipoDaLista } from "./busca";

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
