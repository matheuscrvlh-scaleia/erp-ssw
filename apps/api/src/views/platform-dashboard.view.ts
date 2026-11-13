import { type SaidaDe } from "@erp/shared/contract";
import { type contratosPainelPlataforma } from "@erp/shared/contracts/platform-dashboard";

import { type PainelMontado } from "../models/platform-dashboard/platform-dashboard.service";

const iso = (d: Date | null) => d?.toISOString() ?? null;

export function apresentarPainel(
  painel: PainelMontado,
): SaidaDe<typeof contratosPainelPlataforma.obter> {
  return {
    ...painel,
    geradoEm: painel.geradoEm.toISOString(),
    empresas: painel.empresas.map((e) => ({
      ...e,
      criadaEm: e.criadaEm.toISOString(),
      ultimoLoginEm: iso(e.ultimoLoginEm),
      ultimoDadoEm: iso(e.ultimoDadoEm),
    })),
  };
}
