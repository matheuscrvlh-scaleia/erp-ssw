import { createFileRoute } from "@tanstack/react-router";
import { type ComponentType } from "react";

import { HUB_CONFIGURACOES } from "@/acesso/navegacao";
import { buscaDoHub, HubDeAbas, useAbasDoHub } from "@/componentes/layout/HubDeAbas";
import { PaginaConfiguracoes } from "@/modulos/admin/configuracoes/PaginaConfiguracoes";
import { PaginaCodigos } from "@/modulos/codigos/PaginaCodigos";
import { PaginaFeriados } from "@/modulos/historico/PaginaFeriados";
import { PaginaImportacaoSsw } from "@/modulos/ingestao/PaginaImportacaoSsw";
import { PaginaXmlCte } from "@/modulos/ingestao/PaginaXmlCte";
import { PaginaIngestao } from "@/modulos/ingestao-ssw/PaginaIngestao";
import { PaginaEquipes } from "@/modulos/ranking/PaginaEquipes";

/** Administração › Configurações: as telas de configuração da empresa ativa, uma por aba. */
export const Route = createFileRoute("/_autenticado/admin/configuracoes")({
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
