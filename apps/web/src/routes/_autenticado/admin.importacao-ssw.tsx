import { createFileRoute } from "@tanstack/react-router";

import { PaginaImportacaoSsw } from "@/modulos/ingestao/PaginaImportacaoSsw";

export const Route = createFileRoute("/_autenticado/admin/importacao-ssw")({
  component: PaginaImportacaoSsw,
});
