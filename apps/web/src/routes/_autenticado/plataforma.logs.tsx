import { createFileRoute } from "@tanstack/react-router";

import { PaginaLogsDaPlataforma } from "@/modulos/admin/PaginaLogsDaPlataforma";

export const Route = createFileRoute("/_autenticado/plataforma/logs")({
  component: PaginaLogsDaPlataforma,
});
