import { createFileRoute } from "@tanstack/react-router";

import { PaginaLogsDaPlataforma } from "@/modulos/plataforma/PaginasDaPlataforma";

export const Route = createFileRoute("/_autenticado/plataforma/logs")({
  component: PaginaLogsDaPlataforma,
});
