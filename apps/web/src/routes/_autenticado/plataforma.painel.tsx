import { createFileRoute } from "@tanstack/react-router";

import { PaginaPainel } from "@/modulos/painel-plataforma/PaginaPainel";

export const Route = createFileRoute("/_autenticado/plataforma/painel")({
  component: PaginaPainel,
});
