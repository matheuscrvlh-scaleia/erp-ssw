import { type LinhaBonificacao } from "@erp/dominio/bonificacao-entrega";
import { type ParametrosDeBonificacao } from "@erp/shared/contratos/bonificacao-entrega";

/** Valor dos filtros de unidade, função e hora extra que não filtra nada. */
export const TODAS = "__todas__";

/**
 * Os filtros valem sobre as linhas pessoa-dia, então os totais e o resumo por colaborador
 * passam a refletir só o recorte escolhido.
 */
export function filtrarLinhas(
  linhas: readonly LinhaBonificacao[],
  funcao: string,
  horaExtra: string,
): LinhaBonificacao[] {
  return linhas.filter((l) => {
    if (funcao !== TODAS && l.funcao !== funcao) return false;
    if (horaExtra === "sim" && l.horaExtra !== true) return false;
    if (horaExtra === "nao" && l.horaExtra !== false) return false;
    if (horaExtra === "sem_ponto" && l.horaExtra !== null) return false;
    return true;
  });
}

/** Linhas agrupadas pelo dia do romaneio, em ordem crescente de dia. */
export function agruparPorDia(linhas: readonly LinhaBonificacao[]): [string, LinhaBonificacao[]][] {
  const mapa = new Map<string, LinhaBonificacao[]>();
  for (const l of linhas) {
    const dia = l.dataRomaneio.slice(0, 10);
    const atual = mapa.get(dia);
    if (atual) atual.push(l);
    else mapa.set(dia, [l]);
  }
  return [...mapa.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Parâmetros vigentes hoje; sem nenhum vigente, o primeiro da lista. */
export function vigenteHoje(
  linhas: readonly ParametrosDeBonificacao[],
  hoje: string,
): ParametrosDeBonificacao | null {
  return (
    linhas.find(
      (l) => l.vigenciaInicio <= hoje && (l.vigenciaFim === null || l.vigenciaFim >= hoje),
    ) ??
    linhas[0] ??
    null
  );
}
