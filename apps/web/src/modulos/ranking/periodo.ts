/**
 * Meses e datas das telas de ranking, bonificação e ponto, no fuso do navegador (igual a hoje).
 * O período do ranking operacional usa `resolverPeriodo` do kit (dia de Brasília).
 * origem: periodoDoMes (BonificacaoScreen.tsx)
 */

/** Data local (não UTC) como AAAA-MM-DD. */
export function isoLocal(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
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
