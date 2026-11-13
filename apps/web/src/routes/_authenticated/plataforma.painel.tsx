import { createFileRoute } from "@tanstack/react-router";

import { PaginaPainel } from "@/modules/platform-dashboard/DashboardPage";

export const Route = createFileRoute("/_authenticated/plataforma/painel")({
  component: PaginaPainel,
});
