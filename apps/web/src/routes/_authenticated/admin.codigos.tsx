import { createFileRoute, redirect } from "@tanstack/react-router";

/** Endereço antigo: a tela virou a aba "codigos" de Administração › Configurações. */
export const Route = createFileRoute("/_authenticated/admin/codigos")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/configuracoes", search: { aba: "codigos" } });
  },
});
