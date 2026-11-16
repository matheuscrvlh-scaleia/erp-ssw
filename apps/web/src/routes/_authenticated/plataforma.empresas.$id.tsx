import { createFileRoute } from "@tanstack/react-router";

import { buscaDoHub } from "@/components/layout/TabHub";
import { PaginaEmpresa } from "@/modules/platform/CompanyPage";

export const Route = createFileRoute("/_authenticated/plataforma/empresas/$id")({
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
