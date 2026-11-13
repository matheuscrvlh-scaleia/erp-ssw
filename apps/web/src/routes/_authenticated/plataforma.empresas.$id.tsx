import { createFileRoute } from "@tanstack/react-router";

import { ABAS_ANTIGAS_DE_IMPORTACAO } from "@/access/navigation";
import { buscaDoHub } from "@/components/layout/TabHub";
import { useLogsDasIntegracoes } from "@/modules/admin/use-integrations";
import { PaginaXmlCte } from "@/modules/ingestion/CteXmlPage";
import { PaginaImportacaoSsw } from "@/modules/ingestion/SswImportPage";
import { PaginaEmpresa, type SecaoNaEmpresaAtiva } from "@/modules/platform/CompanyPage";
import { PaginaDiagnostico } from "@/modules/ssw-ingestion/DiagnosticsPage";
import { PaginaIngestao } from "@/modules/ssw-ingestion/IngestionPage";

export const Route = createFileRoute("/_authenticated/plataforma/empresas/$id")({
  validateSearch: buscaDoHub,
  component: PaginaDaRota,
});

/** Abas da empresa feitas de telas de outros módulos: operam na empresa ativa da sessão. */
const CONTEUDO_NA_EMPRESA_ATIVA: Record<string, readonly SecaoNaEmpresaAtiva[]> = {
  importacoes: [
    { requisito: "admin_ingestao", Tela: PaginaIngestao },
    { requisito: "admin_importacao_ssw", Tela: PaginaImportacaoSsw },
    { requisito: "admin_xml_cte", Tela: PaginaXmlCte },
    { requisito: "admin_ssw_diagnostico", Tela: PaginaDiagnostico },
  ],
};

function PaginaDaRota() {
  const { id } = Route.useParams();
  const { aba } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <PaginaEmpresa
      id={id}
      aba={aba && ABAS_ANTIGAS_DE_IMPORTACAO.includes(aba) ? "importacoes" : aba}
      aoMudarAba={(nova) => void navigate({ search: { aba: nova } })}
      naEmpresaAtiva={CONTEUDO_NA_EMPRESA_ATIVA}
      useLogsDasIntegracoes={useLogsDasIntegracoes}
    />
  );
}
