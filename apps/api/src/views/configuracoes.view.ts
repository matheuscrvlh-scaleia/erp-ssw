import { type SaidaDe } from "@erp/shared/contrato";
import { type contratosAdmin, type contratosConfiguracoes } from "@erp/shared/contratos/admin";

import { type ConfiguracaoGravada } from "../models/configuracoes/configuracoes.service";

/** Em ordem de grupo e chave, como a tela lista. */
export function apresentarConfiguracoes(
  configuracoes: readonly ConfiguracaoGravada[],
): SaidaDe<typeof contratosAdmin.listarConfiguracoes> {
  return {
    configuracoes: [...configuracoes]
      .sort((a, b) => a.grupo.localeCompare(b.grupo) || a.chave.localeCompare(b.chave))
      .map((c) => ({ ...c, atualizadoEm: c.atualizadoEm.toISOString() })),
  };
}

export function apresentarConfiguracoesPublicas(
  valores: ReadonlyMap<string, string>,
): SaidaDe<typeof contratosConfiguracoes.publicas> {
  return { valores: Object.fromEntries(valores) };
}
