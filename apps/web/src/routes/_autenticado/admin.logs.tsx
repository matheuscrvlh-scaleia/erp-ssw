import { createFileRoute } from "@tanstack/react-router";

import { Pagina } from "@/componentes/layout/Pagina";
import { useLogsComAbas } from "@/modulos/admin/use-logs-com-abas";

export const Route = createFileRoute("/_autenticado/admin/logs")({
  component: PaginaLogs,
});

function PaginaLogs() {
  const logs = useLogsComAbas();
  return (
    <Pagina
      titulo="Logs"
      descricao="O que mudou nos cadastros e configurações da empresa, quem mudou e quando (clique numa linha para ver o antes e o depois), e o que as integrações fizeram."
      abas={logs.abas}
      filtros={logs.filtros}
    >
      {logs.conteudo}
    </Pagina>
  );
}
