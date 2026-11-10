import { createFileRoute } from "@tanstack/react-router";

import { PaginaEquipes } from "@/modulos/ranking/PaginaEquipes";

export const Route = createFileRoute("/_autenticado/admin/equipes")({
  component: PaginaEquipes,
});
