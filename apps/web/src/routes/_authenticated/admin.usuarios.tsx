import { z } from "@erp/shared/zod";
import { createFileRoute } from "@tanstack/react-router";

import { ABAS_DE_USUARIOS, PaginaUsuariosECargos } from "@/modules/admin/UsersAndRolesPage";

const busca = z.object({ aba: z.enum(ABAS_DE_USUARIOS).optional().catch(undefined) });

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  validateSearch: (s) => busca.parse(s),
  component: UsuariosECargos,
});

function UsuariosECargos() {
  const { aba } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <PaginaUsuariosECargos
      aba={aba}
      aoMudarAba={(proxima) => void navigate({ search: { aba: proxima }, replace: true })}
    />
  );
}
