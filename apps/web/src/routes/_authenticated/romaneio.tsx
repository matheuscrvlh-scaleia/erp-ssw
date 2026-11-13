import { createFileRoute } from "@tanstack/react-router";

import { PaginaRomaneio } from "@/modules/manifest/ManifestPage";

export const Route = createFileRoute("/_authenticated/romaneio")({
  component: PaginaRomaneio,
});
