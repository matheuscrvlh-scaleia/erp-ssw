import { createFileRoute } from "@tanstack/react-router";

import { CabecalhoDaPagina } from "@/modulos/admin/comum";
import { LogsComAbas } from "@/modulos/admin/logs/Logs";

export const Route = createFileRoute("/_autenticado/admin/logs")({
  component: PaginaLogs,
});

function PaginaLogs() {
  return (
    <div className="space-y-6">
      <CabecalhoDaPagina
        titulo="Logs"
        descricao="O que mudou nos cadastros e configurações da empresa, quem mudou e quando (clique numa linha para ver o antes e o depois), e o que as integrações fizeram."
      />
      <LogsComAbas />
    </div>
  );
}
