import { createFileRoute } from "@tanstack/react-router";

import { HUB_CONFIGURACOES_DA_PLATAFORMA } from "@/acesso/navegacao";
import { buscaDoHub, HubDeAbas, useAbasDoHub } from "@/componentes/layout/HubDeAbas";
import { PaginaFeriadosGerais } from "@/modulos/calendario/PaginaFeriadosGerais";
import { PaginaIntegracoesDaPlataforma } from "@/modulos/plataforma/PaginaIntegracoesDaPlataforma";

/** Plataforma › Configurações: integrações gerais e feriados que valem para todas as empresas. */
export const Route = createFileRoute("/_autenticado/plataforma/configuracoes")({
  validateSearch: buscaDoHub,
  component: PaginaDaRota,
});

function PaginaDaRota() {
  const { aba } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { visiveis, atual } = useAbasDoHub(HUB_CONFIGURACOES_DA_PLATAFORMA.abas, aba);
  return (
    <HubDeAbas
      titulo="Configurações"
      rotulo="Abas das configurações da Plataforma"
      visiveis={visiveis}
      atual={atual}
      aoMudar={(nova) => void navigate({ search: { aba: nova } })}
    >
      {(a) =>
        a.valor === "feriados-gerais" ? <PaginaFeriadosGerais /> : <PaginaIntegracoesDaPlataforma />
      }
    </HubDeAbas>
  );
}
