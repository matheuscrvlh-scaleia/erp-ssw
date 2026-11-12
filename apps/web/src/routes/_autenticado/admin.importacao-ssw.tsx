import { createFileRoute, redirect } from "@tanstack/react-router";

/** Endereço antigo: a tela virou a aba "importacao-ssw" de Administração › Configurações. */
export const Route = createFileRoute("/_autenticado/admin/importacao-ssw")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/configuracoes", search: { aba: "importacao-ssw" } });
  },
});
