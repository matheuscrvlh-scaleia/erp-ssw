import { createFileRoute } from "@tanstack/react-router";

import { PaginaUsuarios } from "@/modulos/admin/usuarios/PaginaUsuarios";

export const Route = createFileRoute("/_autenticado/admin/usuarios")({
  component: PaginaUsuarios,
});
