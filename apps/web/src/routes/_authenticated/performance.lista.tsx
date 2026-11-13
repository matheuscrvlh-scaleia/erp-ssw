import { createFileRoute } from "@tanstack/react-router";

import { PaginaListagem } from "@/modules/listing/ListingPage";
import { lerBuscaDaLista } from "@/modules/listing/search";

export const Route = createFileRoute("/_authenticated/performance/lista")({
  validateSearch: lerBuscaDaLista,
  component: PaginaListagem,
});
