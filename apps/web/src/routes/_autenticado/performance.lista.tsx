import { createFileRoute } from "@tanstack/react-router";

import { lerBuscaDaLista } from "@/modulos/listagem/busca";
import { PaginaListagem } from "@/modulos/listagem/PaginaListagem";

export const Route = createFileRoute("/_autenticado/performance/lista")({
  validateSearch: lerBuscaDaLista,
  component: PaginaListagem,
});
