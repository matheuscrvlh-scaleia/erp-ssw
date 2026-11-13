import { type SaidaDe } from "@erp/shared/contract";
import { type Cargo, type contratosAdmin } from "@erp/shared/contracts/admin";

export function apresentarCargos(cargos: Cargo[]): SaidaDe<typeof contratosAdmin.listarCargos> {
  return { cargos };
}
