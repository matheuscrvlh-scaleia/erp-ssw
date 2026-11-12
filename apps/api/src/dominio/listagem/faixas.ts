/**
 * Faixas e classificações da Listagem: dias de atraso (gráfico) e o status/vencimento dos
 * previstos (recortes `previstos_por_status` e `previstos_por_faixa`).
 */
import { type TipoRecorte } from "@erp/shared/contratos/listagem";

import { CODIGOS_ENTREGA } from "../nucleo";

interface FaixaDeAtraso {
  faixa: string;
  ordem: number;
  min: number;
  max: number | null;
}

/** origem: listar_ctrcs_detalhado_agregado_por_faixa_atraso (sistema atual) */
const FAIXAS_DE_ATRASO: readonly FaixaDeAtraso[] = [
  { faixa: "Até 3 dias", ordem: 1, min: 1, max: 3 },
  { faixa: "4–5 dias", ordem: 2, min: 4, max: 5 },
  { faixa: "6–8 dias", ordem: 3, min: 6, max: 8 },
  { faixa: "9–15 dias", ordem: 4, min: 9, max: 15 },
  { faixa: "16–30 dias", ordem: 5, min: 16, max: 30 },
  { faixa: "+30 dias", ordem: 6, min: 31, max: null },
];

/** Só atraso positivo entra no gráfico; 0, negativo e vazio ficam fora. */
export function faixaDeAtraso(dias: number | null): FaixaDeAtraso | null {
  if (dias === null || dias <= 0) return null;
  return FAIXAS_DE_ATRASO.find((f) => f.max === null || dias <= f.max) ?? null;
}

/**
 * Soma as contagens por dia de atraso nas faixas, na ordem fixa, sem as faixas vazias.
 * origem: listar_ctrcs_detalhado_agregado_por_faixa_atraso (sistema atual)
 */
export function agruparPorFaixaDeAtraso(
  contagens: readonly { atraso: number; qtd: number }[],
): (FaixaDeAtraso & { qtd: number })[] {
  const somas = new Map<number, number>();
  for (const { atraso, qtd } of contagens) {
    const faixa = faixaDeAtraso(atraso);
    if (faixa) somas.set(faixa.ordem, (somas.get(faixa.ordem) ?? 0) + qtd);
  }
  return FAIXAS_DE_ATRASO.flatMap((f) => {
    const qtd = somas.get(f.ordem);
    return qtd ? [{ ...f, qtd }] : [];
  });
}

/** O gráfico "Dias de Atraso" só é calculado para estes recortes. */
const RECORTES_COM_FAIXA: readonly TipoRecorte[] = [
  "atrasados",
  "fora_prazo",
  "por_faixa_atraso",
  "previstos_por_faixa",
  "sem_movimento",
  "ocorr_em_atraso",
];

export function pedeFaixaDeAtraso(recortes: readonly TipoRecorte[]): boolean {
  return recortes.some((r) => RECORTES_COM_FAIXA.includes(r));
}

/**
 * Códigos que decidem o status do previsto (o resto é "pendência" pelo tipo do catálogo ou
 * "outros"). Agendamento 35; em rota 85 e 7; programação 80, 82, 83, 84 ou sem código.
 * origem: _bucket_status_previsto (sistema atual)
 */
export const CODIGO_AGENDAMENTO = 35;
export const CODIGOS_EM_ROTA: readonly number[] = [85, 7];
export const CODIGOS_PROGRAMACAO: readonly number[] = [80, 82, 83, 84];

/** Recortes que mostram "Todos em aberto" no título quando o período é ignorado. */
export function recorteSemPeriodo(recorte: TipoRecorte): boolean {
  return (
    recorte.startsWith("previstos_") ||
    recorte === "vencimento_proximo" ||
    recorte === "sem_atualizacao"
  );
}

/**
 * Finalizadores do alerta "Saíram para entrega com prazo vencido" (lista do cliente de 09/10):
 * aqui 18 e 67 não finalizam e 59 (carga roubada) finaliza.
 * origem: src/features/performance/lista/em-aberto.ts (sistema atual)
 */
const FINALIZADORES_SAIU_COM_PRAZO_VENCIDO: readonly number[] = [
  1, 12, 36, 59, 61, 77, 92, 93, 94, 99,
];

/**
 * Código que conta como "em aberto" no seletor Ocorrência: sem entrega (1/18/67) e sem baixa do
 * cadastro; em "Saíram para entrega com prazo vencido" vale a lista própria de finalizadores.
 * origem: codigoEmAbertoNoRecorte (src/features/performance/lista/em-aberto.ts, sistema atual)
 */
export function codigoEmAbertoNoRecorte(
  recorte: TipoRecorte,
  codigo: { codigo: number; tipo: string | null },
): boolean {
  if (recorte === "nascido_atrasado") {
    return !FINALIZADORES_SAIU_COM_PRAZO_VENCIDO.includes(codigo.codigo);
  }
  return !CODIGOS_ENTREGA.has(codigo.codigo) && codigo.tipo !== "BAIXA";
}
