import { createFileRoute } from "@tanstack/react-router";

import { PaginaBonificacaoEntrega } from "@/modulos/bonificacao-entrega/PaginaBonificacaoEntrega";

export const Route = createFileRoute("/_autenticado/admin/bonificacao-entrega")({
  component: PaginaBonificacaoEntrega,
});
