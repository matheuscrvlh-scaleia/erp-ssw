import { createFileRoute, redirect } from "@tanstack/react-router";

import { consultaAcesso } from "@/access/session";

/** Endereço antigo: a tela virou a aba "diagnostico" de Plataforma › Empresas › {empresa ativa}. */
export const Route = createFileRoute("/_authenticated/admin/ssw-diagnostico")({
  beforeLoad: async ({ context }) => {
    const { empresa } = await context.queryClient.query(consultaAcesso);
    if (!empresa) throw redirect({ to: "/plataforma/empresas" });
    throw redirect({
      to: "/plataforma/empresas/$id",
      params: { id: empresa.id },
      search: { aba: "diagnostico" },
    });
  },
});
