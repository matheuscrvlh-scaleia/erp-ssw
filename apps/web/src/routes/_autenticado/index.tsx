import { primeiroCaminhoPermitido } from "@erp/shared/acesso/telas";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { consultaAcesso } from "@/acesso/sessao";

/** `/` leva à primeira tela com página que o usuário pode ver. */
export const Route = createFileRoute("/_autenticado/")({
  beforeLoad: async ({ context }) => {
    const acesso = await context.queryClient.query(consultaAcesso);
    throw redirect({ href: primeiroCaminhoPermitido(acesso.telas) });
  },
});
