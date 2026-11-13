import { createFileRoute } from "@tanstack/react-router";

import { PaginaOcorrencias } from "@/modules/occurrences/OccurrencesPage";
import { migrarBuscaAntiga } from "@/modules/occurrences/search";

export const Route = createFileRoute("/_authenticated/ocorrencias")({
  validateSearch: migrarBuscaAntiga,
  component: PaginaOcorrencias,
});
