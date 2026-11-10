import { type TipoFeriado } from "@erp/shared/contratos/calendario";
import { diaDaSemana, montarDataIso, somarDias } from "@erp/shared/datas";

export const MESES = [
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

export interface DiaDaGrade {
  iso: string;
  dia: number;
  outroMes: boolean;
}

/** 6 semanas a partir do domingo da semana do dia 1 (`mes` de 0 a 11), sempre 42 dias. */
export function montarGradeDoMes(ano: number, mes: number): DiaDaGrade[] {
  const primeiro = montarDataIso(ano, mes + 1, 1);
  const inicio = somarDias(primeiro, -diaDaSemana(primeiro));
  const mesIso = primeiro.slice(0, 7);
  return Array.from({ length: 42 }, (_, i) => {
    const iso = somarDias(inicio, i);
    return { iso, dia: Number(iso.slice(8)), outroMes: iso.slice(0, 7) !== mesIso };
  });
}

/** `2026-11-15` → "Dom, 15 de nov". */
export function formatarDiaCurto(iso: string): string {
  const mes = MESES[Number(iso.slice(5, 7)) - 1] ?? "";
  return `${SEMANA_CURTA[diaDaSemana(iso)] ?? ""}, ${iso.slice(8)} de ${mes}`;
}

export function textoDaDistancia(dias: number): string {
  if (dias === 0) return "hoje";
  return dias > 0 ? `em ${dias}d` : `há ${-dias}d`;
}

export function corDoTipo(tipo: TipoFeriado): string {
  if (tipo === "nacional") return "bg-rose-500/20 text-rose-300 border-rose-500/40";
  if (tipo === "municipal") return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  return "bg-sky-500/20 text-sky-300 border-sky-500/40";
}

/** Feriados por data, para pintar a grade sem procurar na lista a cada dia. */
export function porData<F extends { data: string }>(feriados: readonly F[]): Map<string, F[]> {
  const mapa = new Map<string, F[]>();
  for (const f of feriados) mapa.set(f.data, [...(mapa.get(f.data) ?? []), f]);
  return mapa;
}
