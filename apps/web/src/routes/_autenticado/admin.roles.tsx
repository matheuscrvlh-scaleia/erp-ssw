import { createFileRoute, redirect } from "@tanstack/react-router";

/** Roles virou a aba Cargos de Usuários e cargos (a URL antiga continua abrindo). */
export const Route = createFileRoute("/_autenticado/admin/roles")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/usuarios", search: { aba: "cargos" }, replace: true });
  },
});
