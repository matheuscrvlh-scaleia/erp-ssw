import { createFileRoute } from "@tanstack/react-router";

import { PaginaHistorico } from "@/modulos/historico/PaginaHistorico";

export const Route = createFileRoute("/_autenticado/historico")({
  component: PaginaHistorico,
});
