/**
 * Meses das telas de ranking, bonificação e ponto. O "hoje" vem de fora, já no fuso da empresa
 * (`hojeNoFuso(fuso)`, Q11), nunca do relógio do navegador.
 * O período do ranking operacional usa `resolverPeriodo` do kit.
 * origem: periodoDoMes (BonificacaoScreen.tsx)
 */
import { montarDataIso, somarDias } from "@erp/shared/datas";

/** `AAAA-MM` → do dia 1 ao último dia do mês. */
export function periodoDoMes(mes: string): { inicio: string; fim: string } {
  const [ano = 0, m = 1] = mes.split("-").map(Number);
  return { inicio: `${mes}-01`, fim: somarDias(montarDataIso(ano, m + 1, 1), -1) };
}

/** `AAAA-MM` do dia `AAAA-MM-DD`. */
export function mesDe(dia: string): string {
  return dia.slice(0, 7);
}

/** Mês anterior ao de `hoje` (simulador das regras). */
export function mesAnterior(hoje: string): { inicio: string; fim: string } {
  return periodoDoMes(mesDe(somarDias(`${mesDe(hoje)}-01`, -1)));
}

/** "dd/mm" de uma data AAAA-MM-DD. */
export function diaCurto(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}
