import { type FaixaAtraso } from "@erp/shared/contratos/ocorrencias";
import { diferencaEmDias } from "@erp/shared/datas";

import { estaEntregue, estaFinalizadoSemEntrega } from "../nucleo";

export interface DadosDaSituacao {
  dataEntregaRealizada: Date | null;
  /** Código da ocorrência efetiva já normalizado (`ctes.ocorr_efetiva_codigo_num`). */
  codigoEfetivo: number | null;
  dataPrevistaEntrega: string | null;
}

export interface Situacao {
  entregue: boolean;
  /** Finalizado sem entrega por um código de baixa. */
  baixado: boolean;
  emAberto: boolean;
  /** Em aberto com a previsão já vencida. */
  emAtraso: boolean;
  /** Dias desde a previsão (≥ 1) quando em atraso; nulo nos demais. */
  atrasoDias: number | null;
}

/**
 * Situação do CT-e para as telas de ocorrências. Entrega gravada vence qualquer código; baixa =
 * código do catálogo da empresa com tipo SSW "BAIXA" (Q22 do dono). `hoje` = dia em
 * America/Sao_Paulo (Q11 do dono).
 * origem: CTE univ de ocorrencias_painel_v5 (sistema atual)
 */
export function situacaoDoCte(
  cte: DadosDaSituacao,
  codigosDeBaixa: ReadonlySet<number>,
  hoje: string,
): Situacao {
  const codigo = cte.codigoEfetivo === null ? null : String(cte.codigoEfetivo);
  const entregue = estaEntregue(cte.dataEntregaRealizada, codigo);
  const baixado = estaFinalizadoSemEntrega(cte.dataEntregaRealizada, codigo, codigosDeBaixa);
  const emAberto = !entregue && !baixado;
  const previsao = cte.dataPrevistaEntrega;
  const atrasoDias =
    emAberto && previsao !== null && previsao < hoje ? diferencaEmDias(previsao, hoje) : null;
  return { entregue, baixado, emAberto, emAtraso: atrasoDias !== null, atrasoDias };
}

/** Faixa de atraso do card/bloco "Faixas de atraso". Sem atraso → nulo. */
export function faixaDoAtraso(atrasoDias: number | null): FaixaAtraso | null {
  if (atrasoDias === null || atrasoDias < 1) return null;
  if (atrasoDias <= 3) return "ate_3";
  if (atrasoDias <= 8) return "de_4_8";
  if (atrasoDias <= 15) return "de_9_15";
  if (atrasoDias <= 30) return "de_16_30";
  return "acima_30";
}
