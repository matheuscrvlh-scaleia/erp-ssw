import { diaDaSemana, montarDataIso, somarDias } from "@erp/shared/dates";

interface DiaDaGrade {
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

/** Feriados por data, para pintar a grade sem procurar na lista a cada dia. */
export function porData<F extends { data: string }>(feriados: readonly F[]): Map<string, F[]> {
  const mapa = new Map<string, F[]>();
  for (const f of feriados) mapa.set(f.data, [...(mapa.get(f.data) ?? []), f]);
  return mapa;
}
