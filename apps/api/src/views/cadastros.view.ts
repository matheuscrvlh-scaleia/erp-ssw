import { type SaidaDe } from "@erp/shared/contrato";
import { type Cargo, type contratosAdmin } from "@erp/shared/contratos/admin";

export function apresentarCargos(cargos: Cargo[]): SaidaDe<typeof contratosAdmin.listarCargos> {
  return { cargos };
}
