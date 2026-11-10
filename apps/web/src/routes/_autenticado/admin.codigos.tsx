import { createFileRoute } from "@tanstack/react-router";

import { PaginaCodigos } from "@/modulos/codigos/PaginaCodigos";

export const Route = createFileRoute("/_autenticado/admin/codigos")({
  component: PaginaCodigos,
});
