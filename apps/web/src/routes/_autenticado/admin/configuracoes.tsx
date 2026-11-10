import { createFileRoute } from "@tanstack/react-router";

import { PaginaConfiguracoes } from "@/modulos/admin/configuracoes/PaginaConfiguracoes";

export const Route = createFileRoute("/_autenticado/admin/configuracoes")({
  component: PaginaConfiguracoes,
});
