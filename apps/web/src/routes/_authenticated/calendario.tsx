import { createFileRoute } from "@tanstack/react-router";

import { PaginaCalendario } from "@/modules/calendar/CalendarPage";

export const Route = createFileRoute("/_authenticated/calendario")({
  component: PaginaCalendario,
});
