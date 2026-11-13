import { createFileRoute } from "@tanstack/react-router";

import { PaginaEmpresas } from "@/modules/platform/CompaniesPage";

export const Route = createFileRoute("/_authenticated/plataforma/empresas/")({
  component: PaginaEmpresas,
});
