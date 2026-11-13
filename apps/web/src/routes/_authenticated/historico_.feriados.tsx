import { createFileRoute, redirect } from "@tanstack/react-router";

/** Endereço antigo: a tela virou a aba "feriados" de Administração › Configurações. */
export const Route = createFileRoute("/_authenticated/historico_/feriados")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/configuracoes", search: { aba: "feriados" } });
  },
});
