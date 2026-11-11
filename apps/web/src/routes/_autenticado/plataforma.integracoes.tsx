import { createFileRoute } from "@tanstack/react-router";

import { PaginaIntegracoesDaPlataforma } from "@/modulos/plataforma/IntegracoesDaPlataforma";

export const Route = createFileRoute("/_autenticado/plataforma/integracoes")({
  component: PaginaIntegracoesDaPlataforma,
});
