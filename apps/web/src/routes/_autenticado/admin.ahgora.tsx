import { createFileRoute } from "@tanstack/react-router";

import { PaginaAhgora } from "@/modulos/ahgora/PaginaAhgora";

export const Route = createFileRoute("/_autenticado/admin/ahgora")({
  component: PaginaAhgora,
});
