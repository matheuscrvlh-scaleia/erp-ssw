import { type SaidaDe } from "@erp/shared/contract";
import { type contratosAhgora } from "@erp/shared/contracts/ahgora";

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
