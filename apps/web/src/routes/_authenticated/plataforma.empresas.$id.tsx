import { createFileRoute } from "@tanstack/react-router";
import { type ComponentType } from "react";

import { buscaDoHub } from "@/components/layout/TabHub";
import { useLogsDasIntegracoes } from "@/modules/admin/use-integrations";
import { PaginaXmlCte } from "@/modules/ingestion/CteXmlPage";
import { PaginaImportacaoSsw } from "@/modules/ingestion/SswImportPage";
import { PaginaEmpresa } from "@/modules/platform/CompanyPage";
import { PaginaDiagnostico } from "@/modules/ssw-ingestion/DiagnosticsPage";
import { PaginaIngestao } from "@/modules/ssw-ingestion/IngestionPage";

export const Route = createFileRoute("/_authenticated/plataforma/empresas/$id")({
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
