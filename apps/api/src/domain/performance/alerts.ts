import { type Alertas, type LimitesDosAlertas } from "@erp/shared/contracts/performance";
import { somarDias } from "@erp/shared/dates";

import { arredondar } from "./numbers";
import { compararTexto } from "./primitives";

/** Configuração (texto) → número; vazio ou inválido fica com o padrão. */
function numero(config: ReadonlyMap<string, string>, chave: string, padrao: number): number {
  const valor = config.get(chave);
  if (valor === undefined || valor.trim() === "") return padrao;
  const n = Number(valor.replace(",", "."));
  return Number.isFinite(n) ? n : padrao;
}

/** Limites dos alertas pela configuração da empresa. origem: performance_alertas (padrões) */
export function limitesDosAlertas(config: ReadonlyMap<string, string>): LimitesDosAlertas {
  return {
    vermelhoPct: numero(config, "sla_alerta_vermelho_pct", 95),
    diasSemMovimento: Math.trunc(numero(config, "alerta_dias_sem_movimento", 3)),
    quedaSlaPp: numero(config, "alerta_queda_sla_pp", 5),
    janelaTendenciaDias: Math.max(Math.trunc(numero(config, "alerta_janela_tendencia_dias", 7)), 1),
    janelaVencimentoH: Math.max(Math.trunc(numero(config, "alerta_janela_vencimento_h", 48)), 1),
    minVencimento: Math.trunc(numero(config, "alerta_min_vencimento", 20)),
    nascidoAtrasadoMin: Math.trunc(numero(config, "alerta_nascido_atrasado", 1)),
    desvioFinsistemaPp: numero(config, "alerta_desvio_finsistema_pp", 5),
    diasSemAtualizacao: Math.max(Math.trunc(numero(config, "alerta_dias_sem_atualizacao", 5)), 1),
  };
}

/** Janelas de emissão que os alertas comparam. */
export interface JanelasDosAlertas {
  /** Período da tela. */
  periodo: { inicio: string; fim: string };
  /** Tendência de SLA: últimos J dias até o fim e os J dias antes deles. */
  tendenciaAtual: { inicio: string; fim: string };
  tendenciaAnterior: { inicio: string; fim: string };
  /** Linha de base dos finalizados: as 4 semanas antes do período. */
  baseline: { inicio: string; fim: string };
  /** Menor e maior emissão que a consulta precisa ler. */
  leitura: { inicio: string; fim: string };
}

export function janelasDosAlertas(
  inicio: string,
  fim: string,
  limites: LimitesDosAlertas,
): JanelasDosAlertas {
  const j = limites.janelaTendenciaDias;
  const tendenciaAtual = { inicio: somarDias(fim, -j + 1), fim };
  const tendenciaAnterior = { inicio: somarDias(fim, -2 * j + 1), fim: somarDias(fim, -j) };
  const baseline = { inicio: somarDias(inicio, -28), fim: somarDias(inicio, -1) };
  const menor = [inicio, tendenciaAnterior.inicio, baseline.inicio].sort()[0] ?? inicio;
  return {
    periodo: { inicio, fim },
    tendenciaAtual,
    tendenciaAnterior,
    baseline,
    leitura: { inicio: menor, fim },
  };
}

/** Contagens por filial efetiva lidas na passada por emissão. */
export interface ContagemDosAlertas {
  sigla: string;
  /** No período e no filtro de códigos. */
  semMovimento: number;
  nascidoAtrasado: number;
  /** No período (sem o filtro de códigos). */
  ocorrencia13: number;
  ocorrencia13Multipla: number;
  finTotalAtual: number;
  finAtual: number;
  /** Na linha de base (sem o filtro de códigos). */
  finTotalBaseline: number;
  finBaseline: number;
  /** Tendência: CT-e com pontualidade apurada e no prazo, fora do cliente, com o filtro de códigos. */
  slaBaseAtual: number;
  slaOkAtual: number;
  slaBaseAnterior: number;
  slaOkAnterior: number;
}

/** Em aberto sem período (vencendo nas próximas horas / sem atualização). */
export interface ContagemDosAbertos {
  sigla: string;
  parceiroId: string;
  parceiroNome: string | null;
  vencendo: number;
  semAtualizacao: number;
}

function top<T>(itens: T[], chave: (t: T) => string, qtd: (t: T) => number, n: number): T[] {
  return itens
    .filter((i) => qtd(i) > 0)
    .sort((a, b) => qtd(b) - qtd(a) || compararTexto(chave(a), chave(b)))
    .slice(0, n);
}

function somaPorSigla<T extends { sigla: string }>(itens: readonly T[], campo: (t: T) => number) {
  const m = new Map<string, number>();
  for (const i of itens) m.set(i.sigla, (m.get(i.sigla) ?? 0) + campo(i));
  return [...m].map(([unidade, qtd]) => ({ unidade, qtd }));
}

/**
 * Queda de SLA: só siglas com pelo menos 10 CT-e apurados nas duas janelas e queda ≥ limite.
 * origem: performance_alertas, bloco quedaSla (sistema atual)
 */
function quedaSla(linhas: readonly ContagemDosAlertas[], limites: LimitesDosAlertas) {
  const sla = (ok: number, base: number) => (base >= 10 ? (100 * ok) / base : null);
  const items = linhas
    .filter((l) => l.slaBaseAtual > 0 && l.slaBaseAnterior > 0)
    .flatMap((l) => {
      const atual = sla(l.slaOkAtual, l.slaBaseAtual);
      const anterior = sla(l.slaOkAnterior, l.slaBaseAnterior);
      if (atual === null || anterior === null || anterior - atual < limites.quedaSlaPp) return [];
      return [
        {
          unidade: l.sigla,
          slaAtual: arredondar(atual, 1),
          slaAnterior: arredondar(anterior, 1),
          quedaPp: arredondar(anterior - atual, 1),
          totalAtual: l.slaBaseAtual,
        },
      ];
    })
    .sort((a, b) => b.quedaPp - a.quedaPp || compararTexto(a.unidade, b.unidade));
  return { count: items.length, items };
}

/**
 * Anomalia de finalizados: % finalizados sem entrega no período (≥ 10 CT-e) contra as 4 semanas
 * anteriores (≥ 40 CT-e). origem: performance_alertas, bloco finSistemaAnomalo (sistema atual)
 */
function finSistemaAnomalo(linhas: readonly ContagemDosAlertas[], limites: LimitesDosAlertas) {
  const items = linhas
    .flatMap((l) => {
      const atual = l.finTotalAtual >= 10 ? (100 * l.finAtual) / l.finTotalAtual : null;
      const base = l.finTotalBaseline >= 40 ? (100 * l.finBaseline) / l.finTotalBaseline : null;
      if (atual === null || base === null || atual - base < limites.desvioFinsistemaPp) return [];
      return [
        {
          unidade: l.sigla,
          pctAtual: arredondar(atual, 1),
          pctBaseline: arredondar(base, 1),
          desvioPp: arredondar(atual - base, 1),
          qtdAtual: l.finAtual,
        },
      ];
    })
    .sort((a, b) => b.desvioPp - a.desvioPp || compararTexto(a.unidade, b.unidade));
  return { count: items.length, items };
}

const somar = (itens: readonly { qtd: number }[]) => itens.reduce((s, i) => s + i.qtd, 0);

/**
 * Monta o banner de alertas a partir das contagens. O card "unidades abaixo da meta" sai da
 * pontualidade na tela (não daqui), como hoje.
 * origem: performance_alertas + performance_alerta_ocorrencia_13(_multipla) (sistema atual)
 */
export function montarAlertas(
  linhas: readonly ContagemDosAlertas[],
  abertos: readonly ContagemDosAbertos[],
  limites: LimitesDosAlertas,
): Alertas {
  const porSigla = (campo: (l: ContagemDosAlertas) => number) => somaPorSigla(linhas, campo);
  const nascido = porSigla((l) => l.nascidoAtrasado);
  const oc13 = porSigla((l) => l.ocorrencia13);
  const oc13Multipla = porSigla((l) => l.ocorrencia13Multipla);
  const semAtualizacao = somaPorSigla(abertos, (a) => a.semAtualizacao);

  const parceiros = new Map<
    string,
    { parceiroId: string; parceiroNome: string | null; qtd: number }
  >();
  for (const a of abertos) {
    const chave = `${a.parceiroId}|${a.parceiroNome ?? ""}`;
    const atual = parceiros.get(chave) ?? {
      parceiroId: a.parceiroId,
      parceiroNome: a.parceiroNome,
      qtd: 0,
    };
    parceiros.set(chave, { ...atual, qtd: atual.qtd + a.vencendo });
  }
  const vencendo = [...parceiros.values()];

  return {
    semMovimento: { count: linhas.reduce((s, l) => s + l.semMovimento, 0) },
    quedaSla: quedaSla(linhas, limites),
    vencendo: {
      count: somar(vencendo),
      topParceiros: top(
        vencendo,
        (p) => p.parceiroId,
        (p) => p.qtd,
        5,
      ),
    },
    nascidoAtrasado: {
      count: somar(nascido),
      topUnidades: top(
        nascido,
        (u) => u.unidade,
        (u) => u.qtd,
        5,
      ),
    },
    finSistemaAnomalo: finSistemaAnomalo(linhas, limites),
    semAtualizacao: {
      count: somar(semAtualizacao),
      topUnidades: top(
        semAtualizacao,
        (u) => u.unidade,
        (u) => u.qtd,
        5,
      ),
    },
    ocorrencia13: {
      count: somar(oc13),
      topUnidades: top(
        oc13,
        (u) => u.unidade,
        (u) => u.qtd,
        3,
      ),
    },
    ocorrencia13Multipla: {
      count: somar(oc13Multipla),
      topUnidades: top(
        oc13Multipla,
        (u) => u.unidade,
        (u) => u.qtd,
        3,
      ),
    },
    limites,
  };
}
