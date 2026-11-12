import { createFileRoute } from "@tanstack/react-router";

import { buscaDoHub } from "@/componentes/layout/HubDeAbas";
import { PaginaEmpresa } from "@/modulos/plataforma/PaginasDaPlataforma";

export const Route = createFileRoute("/_autenticado/plataforma/empresas/$id")({
  validateSearch: buscaDoHub,
  component: PaginaDaRota,
});

function PaginaDaRota() {
  const { id } = Route.useParams();
  const { aba } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <PaginaEmpresa
      id={id}
      aba={aba}
      aoMudarAba={(nova) => void navigate({ search: { aba: nova } })}
    />
  );
}
