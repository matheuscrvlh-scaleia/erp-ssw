import { createFileRoute } from "@tanstack/react-router";

import { PaginaFeriados } from "@/modulos/historico/PaginaFeriados";

export const Route = createFileRoute("/_autenticado/historico_/feriados")({
  component: PaginaFeriados,
});
