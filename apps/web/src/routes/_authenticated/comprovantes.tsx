import { createFileRoute } from "@tanstack/react-router";

import { PaginaComprovantes } from "@/modules/delivery-proofs/DeliveryProofsPage";

export const Route = createFileRoute("/_authenticated/comprovantes")({
  component: PaginaComprovantes,
});
