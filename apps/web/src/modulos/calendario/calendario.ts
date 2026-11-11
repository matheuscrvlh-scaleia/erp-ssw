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

/** `2026-11-15` → "Dom, 15 de nov". */
export function formatarDiaCurto(iso: string): string {
  const mes = MESES[Number(iso.slice(5, 7)) - 1] ?? "";
  return `${SEMANA_CURTA[diaDaSemana(iso)] ?? ""}, ${iso.slice(8)} de ${mes}`;
}

export function textoDaDistancia(dias: number): string {
  if (dias === 0) return "hoje";
  return dias > 0 ? `em ${dias}d` : `há ${-dias}d`;
}

/**
 * Cor de cada tipo de feriado (categoria, não situação): fundo leve e borda da série do gráfico,
 * texto no tom principal para manter o contraste nos dois temas.
 */
export function corDoTipo(tipo: TipoFeriado): string {
  if (tipo === "nacional") return "border-serie-2/45 bg-serie-2/12 text-foreground";
  if (tipo === "municipal") return "border-serie-4/50 bg-serie-4/14 text-foreground";
  return "border-serie-1/45 bg-serie-1/12 text-foreground";
}

/** Ponto sólido do tipo (legenda, miniatura do ano). */
export const PONTO_DO_TIPO: Record<TipoFeriado, string> = {
  nacional: "bg-serie-2",
  estadual: "bg-serie-1",
  municipal: "bg-serie-4",
};

/** Feriados por data, para pintar a grade sem procurar na lista a cada dia. */
export function porData<F extends { data: string }>(feriados: readonly F[]): Map<string, F[]> {
  const mapa = new Map<string, F[]>();
  for (const f of feriados) mapa.set(f.data, [...(mapa.get(f.data) ?? []), f]);
  return mapa;
}
