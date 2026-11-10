import { createFileRoute } from "@tanstack/react-router";

import { PaginaDiagnostico } from "@/modulos/ingestao-ssw/PaginaDiagnostico";

export const Route = createFileRoute("/_autenticado/admin/ssw-diagnostico")({
  component: PaginaDiagnostico,
});
