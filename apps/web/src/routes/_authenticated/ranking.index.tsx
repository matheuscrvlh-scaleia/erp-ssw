import { createFileRoute } from "@tanstack/react-router";

import { PaginaRanking } from "@/modules/ranking/RankingPage";

export const Route = createFileRoute("/_authenticated/ranking/")({
  component: PaginaRanking,
});
