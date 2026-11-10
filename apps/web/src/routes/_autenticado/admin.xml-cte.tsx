import { createFileRoute } from "@tanstack/react-router";

import { PaginaXmlCte } from "@/modulos/ingestao/PaginaXmlCte";

export const Route = createFileRoute("/_autenticado/admin/xml-cte")({
  component: PaginaXmlCte,
});
