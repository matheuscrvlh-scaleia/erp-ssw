import { createFileRoute, redirect } from "@tanstack/react-router";

/** Departamento virou cargo: a URL antiga abre a aba Cargos de Usuários e cargos. */
export const Route = createFileRoute("/_autenticado/admin/departamentos")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/usuarios", search: { aba: "cargos" }, replace: true });
  },
});
