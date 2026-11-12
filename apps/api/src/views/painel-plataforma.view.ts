import { type SaidaDe } from "@erp/shared/contrato";
import { type contratosPainelPlataforma } from "@erp/shared/contratos/painel-plataforma";

import { type PainelMontado } from "../models/painel-plataforma/painel-plataforma.service";

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
