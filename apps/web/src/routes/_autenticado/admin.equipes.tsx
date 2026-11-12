import { createFileRoute, redirect } from "@tanstack/react-router";

/** Endereço antigo: a tela virou a aba "equipes" de Administração › Configurações. */
export const Route = createFileRoute("/_autenticado/admin/equipes")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/configuracoes", search: { aba: "equipes" } });
  },
});
