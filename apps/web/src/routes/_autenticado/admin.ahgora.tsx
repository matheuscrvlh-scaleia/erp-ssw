import { createFileRoute, redirect } from "@tanstack/react-router";

import { consultaAcesso } from "@/acesso/sessao";

/** Endereço antigo: a tela virou a aba "ahgora" de Plataforma › Empresas › {empresa ativa}. */
export const Route = createFileRoute("/_autenticado/admin/ahgora")({
  beforeLoad: async ({ context }) => {
    const { empresa } = await context.queryClient.query(consultaAcesso);
    if (!empresa) throw redirect({ to: "/plataforma/empresas" });
    throw redirect({
      to: "/plataforma/empresas/$id",
      params: { id: empresa.id },
      search: { aba: "ahgora" },
    });
  },
});
