import { createFileRoute } from "@tanstack/react-router";

import { validarBusca } from "@/modulos/performance/busca";
import { PaginaPerformance } from "@/modulos/performance/PaginaPerformance";

export const Route = createFileRoute("/_autenticado/performance/")({
  validateSearch: validarBusca,
  component: PaginaPerformance,
});
