import { createFileRoute } from "@tanstack/react-router";

import { PaginaLogsDaPlataforma } from "@/modules/admin/PlatformLogsPage";

export const Route = createFileRoute("/_authenticated/plataforma/logs")({
  component: PaginaLogsDaPlataforma,
});
