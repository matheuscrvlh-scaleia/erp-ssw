import { createFileRoute } from "@tanstack/react-router";

import { PaginaPrazoParceiro } from "@/modulos/prazo-parceiro/PaginaPrazoParceiro";

export const Route = createFileRoute("/_autenticado/prazo-parceiro")({
  component: PaginaPrazoParceiro,
});
