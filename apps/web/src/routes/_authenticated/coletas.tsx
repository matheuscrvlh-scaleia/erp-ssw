import { createFileRoute } from "@tanstack/react-router";

import { PaginaColetas } from "@/modules/pickups/PickupsPage";

export const Route = createFileRoute("/_authenticated/coletas")({
  component: PaginaColetas,
});
