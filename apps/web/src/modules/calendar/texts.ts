import { type Feriado, type UnidadeDoCalendario } from "@erp/shared/contracts/calendar";
import { diaDaSemana } from "@erp/shared/dates";

const MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

export const MESES_LONGOS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"] as const;
const SEMANA_CURTA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

/** `2026-11-15` → "Dom, 15 de nov". */
export function formatarDiaCurto(iso: string): string {
  const mes = MESES[Number(iso.slice(5, 7)) - 1] ?? "";
  return `${SEMANA_CURTA[diaDaSemana(iso)] ?? ""}, ${iso.slice(8)} de ${mes}`;
}

export function textoDaDistancia(dias: number): string {
  if (dias === 0) return "hoje";
  return dias > 0 ? `em ${dias}d` : `há ${-dias}d`;
}

export function nomesDasUnidades(unidades: readonly UnidadeDoCalendario[]): string {
  return unidades.length === 0
    ? "nenhuma unidade cadastrada"
    : unidades.map((u) => u.nome).join(", ");
}

export const localDo = (f: Feriado) => [f.cidade, f.uf].filter(Boolean).join(" / ");
