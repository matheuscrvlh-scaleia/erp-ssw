import { createFileRoute } from "@tanstack/react-router";

import { Pagina } from "@/components/layout/Page";
import { useLogsComAbas } from "@/modules/admin/use-tabbed-logs";

export const Route = createFileRoute("/_authenticated/admin/logs")({
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
