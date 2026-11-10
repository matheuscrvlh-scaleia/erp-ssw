/**
 * Períodos das telas de ranking e bonificação, no fuso do navegador (igual a hoje).
 * origem: resolvePeriodo (RankingTabela.tsx), periodoDoMes (BonificacaoScreen.tsx)
 */

export type PeriodoRapido = "hoje" | "7d" | "30d" | "mes" | "custom";

export interface Periodo {
  inicio: string;
  fim: string;
  rotulo: string;
}

/** Data local (não UTC) como AAAA-MM-DD. */
export function isoLocal(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function diasAtras(hoje: Date, dias: number): string {
  const d = new Date(hoje);
  d.setDate(d.getDate() - dias);
  return isoLocal(d);
}

export function resolverPeriodo(
  rapido: PeriodoRapido,
  hoje: Date,
  de?: string,
  ate?: string,
): Periodo {
  if (rapido === "custom" && de && ate) return { inicio: de, fim: ate, rotulo: `${de} → ${ate}` };
  const fim = isoLocal(hoje);
  if (rapido === "hoje") return { inicio: fim, fim, rotulo: "Hoje" };
  if (rapido === "7d") return { inicio: diasAtras(hoje, 6), fim, rotulo: "Últimos 7 dias" };
  if (rapido === "30d") return { inicio: diasAtras(hoje, 29), fim, rotulo: "Últimos 30 dias" };
  const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  return { inicio: isoLocal(primeiro), fim, rotulo: "Este mês" };
}

/** `AAAA-MM` → do dia 1 ao último dia do mês. */
export function periodoDoMes(mes: string): { inicio: string; fim: string } {
  const [ano = 0, m = 1] = mes.split("-").map(Number);
  const ultimo = new Date(ano, m, 0).getDate();
  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimo).padStart(2, "0")}` };
}

export function mesDe(d: Date): string {
  return isoLocal(d).slice(0, 7);
}

/** Mês anterior ao de `hoje` (simulador das regras). */
export function mesAnterior(hoje: Date): { inicio: string; fim: string } {
  return periodoDoMes(mesDe(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)));
}

/** "dd/mm" de uma data AAAA-MM-DD. */
export function diaCurto(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}
