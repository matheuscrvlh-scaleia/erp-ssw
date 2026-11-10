import { createFileRoute } from "@tanstack/react-router";

import { PaginaRomaneio } from "@/modulos/romaneio/PaginaRomaneio";

export const Route = createFileRoute("/_autenticado/romaneio")({
  component: PaginaRomaneio,
});
