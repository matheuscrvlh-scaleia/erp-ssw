import { createFileRoute } from "@tanstack/react-router";

import { PaginaPerformance } from "@/modules/performance/PerformancePage";
import { validarBusca } from "@/modules/performance/search";

export const Route = createFileRoute("/_authenticated/performance/")({
  validateSearch: validarBusca,
  component: PaginaPerformance,
});
