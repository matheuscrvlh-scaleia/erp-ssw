import { createFileRoute } from "@tanstack/react-router";

import { PaginaPrazoParceiro } from "@/modules/partner-deadline/PartnerDeadlinePage";

export const Route = createFileRoute("/_authenticated/prazo-parceiro")({
  component: PaginaPrazoParceiro,
});
