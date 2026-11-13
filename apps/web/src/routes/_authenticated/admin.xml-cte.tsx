import { createFileRoute, redirect } from "@tanstack/react-router";

/** Endereço antigo: a tela virou a aba "xml-cte" de Administração › Configurações. */
export const Route = createFileRoute("/_authenticated/admin/xml-cte")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/configuracoes", search: { aba: "xml-cte" } });
  },
});
