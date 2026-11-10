import { createFileRoute } from "@tanstack/react-router";

import { PaginaComprovantes } from "@/modulos/comprovantes/PaginaComprovantes";

export const Route = createFileRoute("/_autenticado/comprovantes")({
  component: PaginaComprovantes,
});
