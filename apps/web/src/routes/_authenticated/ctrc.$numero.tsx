import { createFileRoute } from "@tanstack/react-router";

import { PaginaCtrc } from "@/modules/ctrc/CtrcPage";

/** `?sigla=CAP` escolhe a série quando o número existe em mais de uma (Q02). */
export const Route = createFileRoute("/_authenticated/ctrc/$numero")({
  validateSearch: (bruto: Record<string, unknown>): { sigla?: string | undefined } => {
    const sigla = bruto["sigla"];
    return typeof sigla === "string" && sigla.trim() ? { sigla: sigla.trim() } : {};
  },
  component: PaginaCtrc,
});
