import { createFileRoute } from "@tanstack/react-router";
import { type ComponentType } from "react";

import { HUB_CONFIGURACOES } from "@/access/navigation";
import { buscaDoHub, HubDeAbas, useAbasDoHub } from "@/components/layout/TabHub";
import { PaginaConfiguracoes } from "@/modules/admin/SettingsPage";
import { PaginaCodigos } from "@/modules/codes/CodesPage";
import { PaginaFeriados } from "@/modules/history/HolidaysPage";
import { PaginaXmlCte } from "@/modules/ingestion/CteXmlPage";
import { PaginaImportacaoSsw } from "@/modules/ingestion/SswImportPage";
import { PaginaEquipes } from "@/modules/ranking/TeamsPage";
import { PaginaIngestao } from "@/modules/ssw-ingestion/IngestionPage";

/** Administração › Configurações: as telas de configuração da empresa ativa, uma por aba. */
export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  validateSearch: buscaDoHub,
  component: PaginaDaRota,
});

const CONTEUDO: Record<string, ComponentType> = {
  geral: PaginaConfiguracoes,
  codigos: PaginaCodigos,
  ingestao: PaginaIngestao,
  "importacao-ssw": PaginaImportacaoSsw,
  "xml-cte": PaginaXmlCte,
  feriados: PaginaFeriados,
  equipes: PaginaEquipes,
};

function PaginaDaRota() {
  const { aba } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { visiveis, atual } = useAbasDoHub(HUB_CONFIGURACOES.abas, aba);
  return (
    <HubDeAbas
      titulo="Configurações"
      rotulo="Abas das configurações"
      visiveis={visiveis}
      atual={atual}
      aoMudar={(nova) => void navigate({ search: { aba: nova } })}
    >
      {(a) => {
        const Conteudo = CONTEUDO[a.valor];
        return Conteudo && <Conteudo />;
      }}
    </HubDeAbas>
  );
}
