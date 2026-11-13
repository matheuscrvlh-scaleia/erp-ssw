import { createFileRoute } from "@tanstack/react-router";

import { PaginaBonificacaoEntrega } from "@/modules/delivery-bonus/DeliveryBonusPage";

export const Route = createFileRoute("/_authenticated/admin/bonificacao-entrega")({
  component: PaginaBonificacaoEntrega,
});
