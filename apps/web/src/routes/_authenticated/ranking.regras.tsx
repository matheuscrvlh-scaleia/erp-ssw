import { createFileRoute } from "@tanstack/react-router";

import { PaginaRegras } from "@/modules/ranking/RulesPage";

export const Route = createFileRoute("/_authenticated/ranking/regras")({
  component: PaginaRegras,
});
