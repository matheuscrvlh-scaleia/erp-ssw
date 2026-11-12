import { createFileRoute } from "@tanstack/react-router";
import { type ComponentType } from "react";

import { buscaDoHub } from "@/componentes/layout/HubDeAbas";
import { useLogsDasIntegracoes } from "@/modulos/admin/use-integracoes";
import { PaginaImportacaoSsw } from "@/modulos/ingestao/PaginaImportacaoSsw";
import { PaginaXmlCte } from "@/modulos/ingestao/PaginaXmlCte";
import { PaginaDiagnostico } from "@/modulos/ingestao-ssw/PaginaDiagnostico";
import { PaginaIngestao } from "@/modulos/ingestao-ssw/PaginaIngestao";
import { PaginaEmpresa } from "@/modulos/plataforma/PaginaEmpresa";

export const Route = createFileRoute("/_autenticado/plataforma/empresas/$id")({
  validateSearch: buscaDoHub,
  component: PaginaDaRota,
});

/** Abas da empresa que são telas de outros módulos: operam na empresa ativa da sessão. */
const CONTEUDO_NA_EMPRESA_ATIVA: Record<string, ComponentType> = {
  ingestao: PaginaIngestao,
  "importacao-ssw": PaginaImportacaoSsw,
  "xml-cte": PaginaXmlCte,
  diagnostico: PaginaDiagnostico,
};

function PaginaDaRota() {
  const { id } = Route.useParams();
  const { aba } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <PaginaEmpresa
      id={id}
      aba={aba}
      aoMudarAba={(nova) => void navigate({ search: { aba: nova } })}
      naEmpresaAtiva={CONTEUDO_NA_EMPRESA_ATIVA}
      useLogsDasIntegracoes={useLogsDasIntegracoes}
    />
  );
}
