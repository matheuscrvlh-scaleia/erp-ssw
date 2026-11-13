import { createFileRoute } from "@tanstack/react-router";

import { PaginaRankingPublico } from "@/modules/ranking/PublicRankingPage";

/** Link público do ranking da equipe: sem login, fora do layout autenticado. */
export const Route = createFileRoute("/ranking/publico/$token")({
  component: RankingPublico,
});

function RankingPublico() {
  const { token } = Route.useParams();
  return <PaginaRankingPublico token={token} />;
}
