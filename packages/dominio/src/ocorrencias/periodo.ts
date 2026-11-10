import { montarDataIso } from "@erp/shared/datas";

export interface Periodo {
  inicio: string;
  fim: string;
}

const diasNoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();

/**
 * Mesma data um mês antes; dia que não existe no mês anterior vira o último dia dele
 * (31/03 → 28/02). Igual a `(d - interval '1 month')::date` do Postgres.
 * origem: v_ini_ant/v_fim_ant de ocorrencias_painel_v5 (sistema atual)
 */
export function mesAnterior(data: string): string {
  const [ano, mes, dia] = data.split("-").map(Number) as [number, number, number];
  const [anoAnterior, mesAnteriorNum] = mes === 1 ? [ano - 1, 12] : [ano, mes - 1];
  return montarDataIso(
    anoAnterior,
    mesAnteriorNum,
    Math.min(dia, diasNoMes(anoAnterior, mesAnteriorNum)),
  );
}

/** Início e fim deslocados um mês, cada um por conta própria (podem se sobrepor ao atual). */
export function periodoDoMesAnterior(periodo: Periodo): Periodo {
  return { inicio: mesAnterior(periodo.inicio), fim: mesAnterior(periodo.fim) };
}

export function estaNoPeriodo(data: string | null, periodo: Periodo): boolean {
  return data !== null && data >= periodo.inicio && data <= periodo.fim;
}
