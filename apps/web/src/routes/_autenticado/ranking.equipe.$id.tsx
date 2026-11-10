import { ehDataIso } from "@erp/shared/datas";
import { z } from "@erp/shared/zod";
import { createFileRoute } from "@tanstack/react-router";

import { PaginaEquipeDetalhe } from "@/modulos/ranking/PaginaEquipeDetalhe";

const busca = z.object({
  inicio: z.string().refine(ehDataIso),
  fim: z.string().refine(ehDataIso),
  regra: z.uuid(),
});

export const Route = createFileRoute("/_autenticado/ranking/equipe/$id")({
  validateSearch: (s) => busca.parse(s),
  component: EquipeDetalhe,
});

function EquipeDetalhe() {
  const { id } = Route.useParams();
  return <PaginaEquipeDetalhe id={id} busca={Route.useSearch()} />;
}
