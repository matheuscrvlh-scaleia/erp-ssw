import { createFileRoute } from "@tanstack/react-router";

import { PaginaAhgora } from "@/modulos/ahgora/PaginaAhgora";

/** Ahgora no menu principal, na empresa ativa (só para a equipe da Plataforma). */
export const Route = createFileRoute("/_autenticado/admin/ahgora")({
  component: PaginaAhgora,
});
