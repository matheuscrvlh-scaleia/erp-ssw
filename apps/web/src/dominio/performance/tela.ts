import {
  type CodigoDisponivel,
  type ConfiguracaoPerformance,
  type ContagemTipo,
  SEM_TIPO_DOCUMENTO,
  type UnidadeResumo,
} from "@erp/shared/contratos/performance";
import { somarDias } from "@erp/shared/datas";

import { compararTexto } from "./primitivas";

/*
 * Regras de exibição da tela Performance (cores, ordem, período). Puras: a tela só desenha.
 */

export type Status = "bom" | "alerta" | "ruim";

function numero(config: ReadonlyMap<string, string>, chave: string, padrao: number): number {
  const n = Number((config.get(chave) ?? "").replace(",", "."));
  return config.get(chave)?.trim() && Number.isFinite(n) ? n : padrao;
}

/** Metas da tela pela configuração da empresa. origem: useSlaThresholds / useOtifVisivel */
export function configuracaoDaTela(config: ReadonlyMap<string, string>): ConfiguracaoPerformance {
  return {
    slaMetaPct: numero(config, "sla_meta_pct", 95),
    slaAlertaAmareloPct: numero(config, "sla_alerta_amarelo_pct", 90),
    taxaRetornoMetaPct: numero(config, "taxa_retorno_meta_pct", 3),
    otifVisivel: (config.get("otif_visivel") ?? "").trim().toLowerCase() === "true",
  };
}

/** `p >= meta` bom, `>= alerta` atenção, senão ruim (frações). origem: statusFor */
export function statusDoSla(p: number, meta: number, alerta: number): Status {
  if (p >= meta) return "bom";
  return p >= alerta ? "alerta" : "ruim";
}

/** Menor é melhor: até a meta bom, até meta + 1 p.p. atenção. origem: statusForRetorno */
export function statusDoRetorno(taxa: number, meta: number | null): Status {
  if (meta == null || taxa <= meta) return "bom";
  return taxa <= meta + 0.01 ? "alerta" : "ruim";
}

/** OTIF (% com problema): até 5% bom, até 10% atenção. */
export function statusDoOtif(pct: number | null): Status {
  if (pct == null || pct <= 0.05) return "bom";
  return pct <= 0.1 ? "alerta" : "ruim";
}

export const PERIODOS = ["hoje", "7d", "30d", "mes", "custom"] as const;
export type Periodo = (typeof PERIODOS)[number];

/**
 * Período da tela no dia local do navegador (`hoje`): Hoje, 7 dias, 30 dias, mês corrente ou
 * intervalo livre (sem validar `de <= ate`, como hoje). origem: resolvePeriodo
 */
export function resolverPeriodo(
  periodo: Periodo,
  de: string,
  ate: string,
  hoje: string,
): { inicio: string; fim: string; rotulo: string } {
  if (periodo === "custom" && de && ate) return { inicio: de, fim: ate, rotulo: `${de} → ${ate}` };
  if (periodo === "hoje") return { inicio: hoje, fim: hoje, rotulo: "Hoje" };
  if (periodo === "7d") return { inicio: somarDias(hoje, -6), fim: hoje, rotulo: "Últimos 7 dias" };
  if (periodo === "30d")
    return { inicio: somarDias(hoje, -29), fim: hoje, rotulo: "Últimos 30 dias" };
  return { inicio: `${hoje.slice(0, 7)}-01`, fim: hoje, rotulo: "Este mês" };
}

/**
 * Tabela "Performance por unidade": ordena pelo SLA Op. da sigla (pior ou melhor primeiro);
 * sem SLA Op. vai para o fim, por sigla. Empate mantém a ordem do resumo.
 * origem: performance.index.tsx (sistema atual)
 */
export function ordenarUnidades(
  linhas: readonly UnidadeResumo[],
  slaPorSigla: ReadonlyMap<string, number | null>,
  ordem: "pior" | "melhor",
): UnidadeResumo[] {
  return [...linhas].sort((a, b) => {
    const pa = slaPorSigla.get(a.sigla) ?? null;
    const pb = slaPorSigla.get(b.sigla) ?? null;
    if (pa === null || pb === null) {
      if (pa === null && pb === null) return a.sigla.localeCompare(b.sigla);
      return pa === null ? 1 : -1;
    }
    return ordem === "pior" ? pa - pb : pb - pa;
  });
}

/**
 * Opções do seletor Ocorrência: mais CT-e primeiro; empate pelo código como TEXTO ("10" < "9"),
 * como o `ORDER BY` de hoje. origem: performance_codigos_disponiveis
 */
export function ordenarCodigosDisponiveis(
  codigos: readonly CodigoDisponivel[],
): CodigoDisponivel[] {
  return [...codigos].sort((a, b) => b.qtd - a.qtd || compararTexto(a.codigo, b.codigo));
}

/**
 * Seletor de tipo de documento: tipos com CT-e no período primeiro (mais CT-e antes), depois os
 * sem CT-e no período, na ordem das opções. origem: ordenarTiposDocumento
 */
export function ordenarTiposDocumento(
  opcoes: readonly ContagemTipo[],
  noPeriodo: readonly ContagemTipo[] | undefined,
): { tipo: string; rotulo: string; qtd: number }[] {
  const contagem = new Map((noPeriodo ?? []).map((t) => [t.tipo, t.qtd]));
  const todos = [
    ...new Set([...(noPeriodo ?? []).map((t) => t.tipo), ...opcoes.map((t) => t.tipo)]),
  ];
  const rotulo = (tipo: string) => (tipo === SEM_TIPO_DOCUMENTO ? "sem tipo" : tipo);
  const com = todos
    .filter((t) => (contagem.get(t) ?? 0) > 0)
    .sort((a, b) => (contagem.get(b) ?? 0) - (contagem.get(a) ?? 0));
  const sem = todos.filter((t) => (contagem.get(t) ?? 0) === 0);
  return [...com, ...sem].map((tipo) => ({
    tipo,
    rotulo: rotulo(tipo),
    qtd: contagem.get(tipo) ?? 0,
  }));
}

/** Verificação da partição: entregues + finalizados + previstos = emitidos. */
export function verificarParticao(b: {
  totalCtrcs: number;
  entregues: number;
  finalizadoSistema: number;
  previstos: number;
}): { soma: number; diferenca: number } {
  const soma = b.entregues + b.finalizadoSistema + b.previstos;
  return { soma, diferenca: soma - b.totalCtrcs };
}
