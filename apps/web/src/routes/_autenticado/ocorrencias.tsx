import { createFileRoute } from "@tanstack/react-router";

import { migrarBuscaAntiga } from "@/modulos/ocorrencias/busca";
import { PaginaOcorrencias } from "@/modulos/ocorrencias/PaginaOcorrencias";

export const Route = createFileRoute("/_autenticado/ocorrencias")({
  validateSearch: migrarBuscaAntiga,
  component: PaginaOcorrencias,
});
