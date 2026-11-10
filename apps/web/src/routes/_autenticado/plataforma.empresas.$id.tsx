import { createFileRoute } from "@tanstack/react-router";

import { PaginaEmpresa } from "@/modulos/plataforma/PaginasDaPlataforma";

export const Route = createFileRoute("/_autenticado/plataforma/empresas/$id")({
  component: PaginaDaRota,
});

function PaginaDaRota() {
  const { id } = Route.useParams();
  return <PaginaEmpresa id={id} />;
}
