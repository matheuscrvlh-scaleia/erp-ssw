import { createFileRoute } from "@tanstack/react-router";

import { PaginaDeCadastro } from "@/modulos/admin/cadastros/PaginaDeCadastro";

export const Route = createFileRoute("/_autenticado/admin/roles")({
  component: () => <PaginaDeCadastro tipo="cargo" />,
});
