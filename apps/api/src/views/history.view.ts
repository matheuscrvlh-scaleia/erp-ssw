import { type SaidaDe } from "@erp/shared/contract";
import { type contratosHistorico } from "@erp/shared/contracts/history";

import { type FeriadoGravado } from "../models/calendar/calendar.service";
import { type HistoricoDoPeriodo } from "../models/history/history.service";
import { apresentarFeriado } from "./calendar.view";

export function apresentarHistorico(
  historico: HistoricoDoPeriodo,
): SaidaDe<typeof contratosHistorico.obter> {
  return { ...historico, feriados: historico.feriados.map(apresentarFeriado) };
}

/** Na aba Feriados, a empresa dona vira só "é global" (nacional da plataforma, sem empresa). */
export function apresentarFeriados(lista: {
  feriados: FeriadoGravado[];
  truncado: boolean;
}): SaidaDe<typeof contratosHistorico.listarFeriados> {
  return {
    feriados: lista.feriados.map((f) => ({
      ...apresentarFeriado(f),
      global: f.empresaId === null,
    })),
    truncado: lista.truncado,
  };
}

/** A tela do Histórico só mostra quantos entraram. */
export function apresentarFeriadoCriado({
  inseridos,
}: {
  inseridos: number;
}): SaidaDe<typeof contratosHistorico.criarFeriado> {
  return { inseridos };
}
