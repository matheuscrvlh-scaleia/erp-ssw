import { type SaidaDe } from "@erp/shared/contrato";
import { type contratosCalendario, type Feriado } from "@erp/shared/contratos/calendario";

import { type CalendarioDoAno, type FeriadoGravado } from "../models/calendario/calendario.service";

/** O feriado como a tela vê: a empresa dona fica no servidor. */
export function apresentarFeriado({ empresaId: _empresaId, ...feriado }: FeriadoGravado): Feriado {
  return feriado;
}

export function apresentarCalendario(
  calendario: CalendarioDoAno,
): SaidaDe<typeof contratosCalendario.obter> {
  return {
    ...calendario,
    feriados: calendario.feriados.map(apresentarFeriado),
    proximo: calendario.proximo && apresentarFeriado(calendario.proximo),
  };
}

export function apresentarFeriadosGerais(
  feriados: FeriadoGravado[],
): SaidaDe<typeof contratosCalendario.listarFeriadosGerais> {
  return { feriados: feriados.map(apresentarFeriado) };
}
