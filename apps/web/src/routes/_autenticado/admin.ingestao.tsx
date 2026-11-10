import { createFileRoute } from "@tanstack/react-router";

import { PaginaIngestao } from "@/modulos/ingestao-ssw/PaginaIngestao";

export const Route = createFileRoute("/_autenticado/admin/ingestao")({
  component: PaginaIngestao,
});
