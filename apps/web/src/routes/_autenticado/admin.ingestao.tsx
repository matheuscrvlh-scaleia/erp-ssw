import { createFileRoute, redirect } from "@tanstack/react-router";

/** Endereço antigo: a tela virou a aba "ingestao" de Administração › Configurações. */
export const Route = createFileRoute("/_autenticado/admin/ingestao")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/configuracoes", search: { aba: "ingestao" } });
  },
});
