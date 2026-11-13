import { primeiroCaminhoPermitido } from "@erp/shared/access/screens";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { consultaAcesso } from "@/access/session";

/** `/` leva à primeira tela com página que o usuário pode ver. */
export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: async ({ context }) => {
    const acesso = await context.queryClient.query(consultaAcesso);
    throw redirect({ href: primeiroCaminhoPermitido(acesso.telas) });
  },
});
