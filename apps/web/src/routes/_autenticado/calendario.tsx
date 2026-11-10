import { createFileRoute } from "@tanstack/react-router";

import { PaginaCalendario } from "@/modulos/calendario/PaginaCalendario";

export const Route = createFileRoute("/_autenticado/calendario")({
  component: PaginaCalendario,
});
