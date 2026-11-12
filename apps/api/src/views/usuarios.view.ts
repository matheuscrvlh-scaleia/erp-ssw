import { type SaidaDe } from "@erp/shared/contrato";
import { type contratosAdmin, type UsuarioDaEmpresa } from "@erp/shared/contratos/admin";

export function apresentarUsuarios(
  usuarios: UsuarioDaEmpresa[],
): SaidaDe<typeof contratosAdmin.listarUsuarios> {
  return { usuarios };
}
