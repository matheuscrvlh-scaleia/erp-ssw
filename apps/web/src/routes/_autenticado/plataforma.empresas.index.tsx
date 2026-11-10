import { createFileRoute } from "@tanstack/react-router";

import { PaginaEmpresas } from "@/modulos/plataforma/PaginaEmpresas";

export const Route = createFileRoute("/_autenticado/plataforma/empresas/")({
  component: PaginaEmpresas,
});
