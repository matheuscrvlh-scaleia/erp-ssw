import { type SaidaDe } from "@erp/shared/contrato";
import { type contratosAdmin, type PrazoConfigurado } from "@erp/shared/contratos/admin";

import { type PrazosDaEmpresa, type RegraGravada } from "../models/prazos/prazos.service";

const ORDEM_DO_TIPO = { unidade: 1, transbordo: 2, parceiro: 3 } as const;

function apresentarRegra({ criadoEm: _criadoEm, ...r }: RegraGravada): PrazoConfigurado {
  return { ...r, atualizadoEm: r.atualizadoEm.toISOString() };
}

/** Regras por tipo (unidade, transbordo, parceiro) e as mais recentes antes. */
export function apresentarPrazos(
  prazos: PrazosDaEmpresa,
): SaidaDe<typeof contratosAdmin.listarPrazos> {
  const regras = [...prazos.regras].sort(
    (a, b) =>
      ORDEM_DO_TIPO[a.tipo] - ORDEM_DO_TIPO[b.tipo] ||
      b.atualizadoEm.getTime() - a.atualizadoEm.getTime(),
  );
  return { ...prazos, regras: regras.map(apresentarRegra) };
}
