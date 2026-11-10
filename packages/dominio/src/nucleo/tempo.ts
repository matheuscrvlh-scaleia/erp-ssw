import { diaDaSemana, diferencaEmDias, hojeNoFuso, somarDias } from "@erp/shared/datas";

/**
 * Dia de negócio como texto `AAAA-MM-DD` (coluna `date`). Todo "dia" do núcleo é o de Brasília
 * (Q11 do dono): nada usa o fuso UTC da sessão do banco.
 */
export type DataIso = string;

export const FUSO_DO_NEGOCIO = "America/Sao_Paulo";

/** Brasília não tem horário de verão desde 2019: o deslocamento é fixo. */
const DESLOCAMENTO_SP = "-03:00";
const MS_POR_HORA = 3_600_000;
const MS_POR_DIA = 24 * MS_POR_HORA;

/** origem: (instante AT TIME ZONE 'America/Sao_Paulo')::date (sistema atual) */
export function diaSp(instante: Date): DataIso {
  return hojeNoFuso(FUSO_DO_NEGOCIO, instante);
}

/** "Hoje" do negócio. `agora` vem sempre do relógio injetado. */
export function hojeSp(agora: Date): DataIso {
  return diaSp(agora);
}

/** `a - b` em dias, como `date - date` do Postgres. */
export function difDias(a: DataIso, b: DataIso): number {
  return diferencaEmDias(b, a);
}

/** `date + int` do Postgres. */
export function somarDiasCorridos(dia: DataIso, dias: number): DataIso {
  return somarDias(dia, dias);
}

/** Meia-noite de Brasília do dia (Q11: substitui o `data::timestamptz` da sessão UTC). */
export function inicioDoDiaSp(dia: DataIso): Date {
  return new Date(`${dia}T00:00:00${DESLOCAMENTO_SP}`);
}

/** `instante - interval 'N days'` (dias de 24 h). */
export function menosDias(instante: Date, dias: number): Date {
  return new Date(instante.getTime() - dias * MS_POR_DIA);
}

/** `instante + interval 'N hours'`. */
export function somarHoras(instante: Date, horas: number): Date {
  return new Date(instante.getTime() + horas * MS_POR_HORA);
}

/** Segunda a sexta. */
export function ehDiaDeSemana(dia: DataIso): boolean {
  const semana = diaDaSemana(dia);
  return semana >= 1 && semana <= 5;
}

/** Menor instante; vazio dá `null`. */
export function menorInstante(instantes: readonly Date[]): Date | null {
  let menor: Date | null = null;
  for (const i of instantes) if (menor === null || i < menor) menor = i;
  return menor;
}
