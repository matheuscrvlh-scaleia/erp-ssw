import { createFileRoute } from "@tanstack/react-router";

import { PaginaRegras } from "@/modulos/ranking/PaginaRegras";

export const Route = createFileRoute("/_autenticado/ranking/regras")({
  component: PaginaRegras,
});
