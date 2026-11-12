import { type SaidaDe } from "@erp/shared/contrato";
import { type contratosAhgora } from "@erp/shared/contratos/ahgora";

import { type ApuracaoDoPeriodo } from "../models/ahgora/ahgora.service";

/** Colaboradores em ordem alfabética, como a tela lista. */
export function apresentarApuracao(
  apuracao: ApuracaoDoPeriodo,
): SaidaDe<typeof contratosAhgora.apuracao> {
  return {
    ...apuracao,
    funcionarios: [...apuracao.funcionarios].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  };
}
