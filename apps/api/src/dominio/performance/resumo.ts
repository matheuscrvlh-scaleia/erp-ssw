import {
  type AgregadosProducao,
  type TotaisResumo,
  type UnidadeResumo,
} from "@erp/shared/contratos/performance";

import { centavos, reais } from "./numeros";
import { compararTexto } from "./primitivas";

/**
 * Contagens de um grupo (filial efetiva × unidade) da base filtrada, como o repositório devolve.
 * Definições por CT-e (spec 02 §1.3/§1.5):
 * - concluído = entregue (data de entrega ou efetiva 1/18/67) ou finalizado sem entrega (baixa);
 * - penalizado = tem ocorrência que penaliza, não é do cliente e o código é acompanhado;
 * - retorno = tem ocorrência 13; vencido = em aberto com previsão antes de hoje.
 */
export interface ContagemDoGrupo {
  sigla: string;
  unidadeId: string | null;
  total: number;
  entregues: number;
  finalizados: number;
  concluidos: number;
  abertos: number;
  penalizados: number;
  penalizadosConcluidos: number;
  penalizadosAbertos: number;
  retornos: number;
  retornosConcluidos: number;
  ocorrenciasPenalizantes: number;
  ocorrenciasPendentes: number;
  emAtraso: number;
  emAtrasoCliente: number;
  semPrazo: number;
  /** `numeric` do banco (texto) ou número. */
  freteRomaneado: string | number | null;
  fretePerdido: string | number | null;
}

/** Meta de taxa de retorno vigente no período (unidade nula = geral, que nunca casa). */
export interface MetaVigente {
  unidadeId: string | null;
  valor: number;
}

type Somavel = Exclude<
  keyof ContagemDoGrupo,
  "sigla" | "unidadeId" | "freteRomaneado" | "fretePerdido"
>;

function somar(grupos: readonly ContagemDoGrupo[], campo: Somavel): number {
  return grupos.reduce((s, g) => s + g[campo], 0);
}

/** `concl > 0 ? 1 − penalizados/concl : 1`. origem: calcular_performance (sistema atual) */
export function performanceDe(concluidos: number, penalizadosConcluidos: number): number {
  return concluidos > 0 ? 1 - penalizadosConcluidos / concluidos : 1;
}

/**
 * Totais da Performance. Taxa de retorno = concluídos com ocorrência 13 ÷ concluídos (decisão Q16:
 * o sistema atual punha no numerador também os CT-e em aberto e passava de 100%).
 * origem: calcular_performance (sistema atual)
 */
export function totaisDoResumo(grupos: readonly ContagemDoGrupo[]): TotaisResumo {
  const concluidos = somar(grupos, "concluidos");
  const emAtraso = somar(grupos, "emAtraso");
  const emAtrasoCliente = somar(grupos, "emAtrasoCliente");
  return {
    totalCtrcs: somar(grupos, "total"),
    ctrcsPenalizados: somar(grupos, "penalizados"),
    ctrcsConcluidos: concluidos,
    performance: performanceDe(concluidos, somar(grupos, "penalizadosConcluidos")),
    taxaRetorno: concluidos > 0 ? somar(grupos, "retornosConcluidos") / concluidos : 0,
    ocorrenciasPenalizantes: somar(grupos, "ocorrenciasPenalizantes"),
    ocorrenciasPendentes: somar(grupos, "ocorrenciasPendentes"),
    ctrcsEmAberto: somar(grupos, "abertos"),
    ctrcsEmAtraso: emAtraso,
    ctrcsEmAtrasoFr: emAtraso - emAtrasoCliente,
    ctrcsEmAtrasoCliente: emAtrasoCliente,
    ctrcsSemPrazo: somar(grupos, "semPrazo"),
  };
}

/**
 * Meta de taxa de retorno ponderada pelos CT-e de cada unidade. Como hoje: a meta geral (sem
 * unidade) não casa com nenhum grupo e uma unidade com duas metas vigentes conta duas vezes.
 * Sem CT-e → nulo; com CT-e e sem meta → 0.
 * origem: calcular_performance (sistema atual)
 */
export function metaPonderada(
  grupos: readonly ContagemDoGrupo[],
  metas: readonly MetaVigente[],
): number | null {
  const porUnidade = new Map<string | null, number>();
  for (const g of grupos) porUnidade.set(g.unidadeId, (porUnidade.get(g.unidadeId) ?? 0) + g.total);
  let numerador = 0;
  let denominador = 0;
  for (const [unidadeId, n] of porUnidade) {
    if (n === 0) continue;
    const daUnidade = unidadeId === null ? [] : metas.filter((m) => m.unidadeId === unidadeId);
    if (daUnidade.length === 0) {
      denominador += n;
      continue;
    }
    for (const m of daUnidade) {
      numerador += n * m.valor;
      denominador += n;
    }
  }
  return denominador > 0 ? numerador / denominador : null;
}

/** Uma linha por filial efetiva, da pior performance para a melhor (desempate pela sigla). */
export function unidadesDoResumo(grupos: readonly ContagemDoGrupo[]): UnidadeResumo[] {
  const porSigla = new Map<string, ContagemDoGrupo[]>();
  for (const g of grupos) porSigla.set(g.sigla, [...(porSigla.get(g.sigla) ?? []), g]);
  return [...porSigla]
    .map(([sigla, gs]) => {
      const concluidos = somar(gs, "concluidos");
      const penalizados = somar(gs, "penalizadosConcluidos");
      return {
        sigla,
        total: somar(gs, "total"),
        concluidos,
        penalizados,
        penalizadosAbertos: somar(gs, "penalizadosAbertos"),
        performance: performanceDe(concluidos, penalizados),
      };
    })
    .sort((a, b) => a.performance - b.performance || compararTexto(a.sigla, b.sigla));
}

/**
 * Agregados da linha de Produção. Decisão Q15: o frete romaneado conta uma vez por CT-e que saiu
 * para entrega (85), e o prejuízo só entre esses (o sistema atual somava o frete uma vez por
 * ocorrência 85 e punha no prejuízo CT-e que nunca saiu).
 * origem: relatorio_bloco_agregados (sistema atual)
 */
export function agregadosDeProducao(grupos: readonly ContagemDoGrupo[]): AgregadosProducao {
  return {
    totalCtrcs: somar(grupos, "total"),
    entregues: somar(grupos, "entregues"),
    finalizadoSemEntrega: somar(grupos, "finalizados"),
    previstos: somar(grupos, "abertos"),
    devolvidos: somar(grupos, "retornos"),
    valorFreteTotal: reais(grupos.reduce((s, g) => s + centavos(g.freteRomaneado), 0)),
    valorFretePerdido: reais(grupos.reduce((s, g) => s + centavos(g.fretePerdido), 0)),
  };
}
