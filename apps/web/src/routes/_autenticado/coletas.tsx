import { createFileRoute } from "@tanstack/react-router";

import { PaginaColetas } from "@/modulos/coletas/PaginaColetas";

export const Route = createFileRoute("/_autenticado/coletas")({
  component: PaginaColetas,
});
