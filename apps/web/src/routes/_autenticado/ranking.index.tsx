import { createFileRoute } from "@tanstack/react-router";

import { PaginaRanking } from "@/modulos/ranking/PaginaRanking";

export const Route = createFileRoute("/_autenticado/ranking/")({
  component: PaginaRanking,
});
