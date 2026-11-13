import { createFileRoute } from "@tanstack/react-router";

import { PaginaHistorico } from "@/modules/history/HistoryPage";

export const Route = createFileRoute("/_authenticated/historico")({
  component: PaginaHistorico,
});
