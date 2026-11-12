import { type SaidaDe } from "@erp/shared/contrato";
import { type contratosHistorico } from "@erp/shared/contratos/historico";

import { type FeriadoGravado } from "../models/calendario/calendario.service";
import { type HistoricoDoPeriodo } from "../models/historico/historico.service";
import { apresentarFeriado } from "./calendario.view";

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
