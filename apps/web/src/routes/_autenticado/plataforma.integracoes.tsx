import { createFileRoute, redirect } from "@tanstack/react-router";

/** Endereço antigo: a tela virou a aba "integracoes" de Plataforma › Configurações. */
export const Route = createFileRoute("/_autenticado/plataforma/integracoes")({
  beforeLoad: () => {
    throw redirect({ to: "/plataforma/configuracoes", search: { aba: "integracoes" } });
  },
});
