import { createFileRoute } from "@tanstack/react-router";

import { PaginaDetalheParceiro } from "@/modulos/prazo-parceiro/PaginaDetalheParceiro";

/** Fora do layout da visão geral: `/prazo-parceiro/<id>` é uma tela própria. */
export const Route = createFileRoute("/_autenticado/prazo-parceiro_/$id")({
  component: PaginaDetalheParceiro,
});
