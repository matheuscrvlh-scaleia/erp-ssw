import { createFileRoute } from "@tanstack/react-router";

import { PaginaAhgora } from "@/modules/ahgora/AhgoraPage";

/** Ahgora no menu principal, na empresa ativa (só para a equipe da Plataforma). */
export const Route = createFileRoute("/_authenticated/admin/ahgora")({
  component: PaginaAhgora,
});
