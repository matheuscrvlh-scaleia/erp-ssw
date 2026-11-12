import { z } from "@erp/shared/zod";
import { createFileRoute } from "@tanstack/react-router";

import {
  ABAS_DA_PLATAFORMA,
  PaginaUsuariosDaPlataforma,
} from "@/modulos/plataforma/UsuariosDaPlataforma";

const busca = z.object({ aba: z.enum(ABAS_DA_PLATAFORMA).optional().catch(undefined) });

/** Plataforma › Usuários e cargos (a URL é a de Administradores, que virou a primeira aba). */
export const Route = createFileRoute("/_autenticado/plataforma/administradores")({
  validateSearch: (s) => busca.parse(s),
  component: UsuariosDaPlataforma,
});

function UsuariosDaPlataforma() {
  const { aba } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <PaginaUsuariosDaPlataforma
      aba={aba ?? "administradores"}
      aoMudarAba={(proxima) => void navigate({ search: { aba: proxima }, replace: true })}
    />
  );
}
