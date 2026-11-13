import { type SaidaDe } from "@erp/shared/contract";
import { type contratosAdmin, type UsuarioDaEmpresa } from "@erp/shared/contracts/admin";

export function apresentarUsuarios(
  usuarios: UsuarioDaEmpresa[],
): SaidaDe<typeof contratosAdmin.listarUsuarios> {
  return { usuarios };
}
