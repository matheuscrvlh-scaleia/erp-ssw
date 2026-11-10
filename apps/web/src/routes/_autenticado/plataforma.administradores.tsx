import { createFileRoute } from "@tanstack/react-router";

import { PaginaAdministradores } from "@/modulos/plataforma/PaginasDaPlataforma";

export const Route = createFileRoute("/_autenticado/plataforma/administradores")({
  component: PaginaAdministradores,
});
