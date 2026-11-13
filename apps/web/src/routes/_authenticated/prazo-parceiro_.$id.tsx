import { createFileRoute } from "@tanstack/react-router";

import { PaginaDetalheParceiro } from "@/modules/partner-deadline/PartnerDetailPage";

/** Fora do layout da visão geral: `/prazo-parceiro/<id>` é uma tela própria. */
export const Route = createFileRoute("/_authenticated/prazo-parceiro_/$id")({
  component: PaginaDetalheParceiro,
});
