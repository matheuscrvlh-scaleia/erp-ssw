import { ROTULO_DO_STATUS } from "@erp/shared/platform";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { ABAS_DA_EMPRESA } from "@/access/navigation";
import { MensagemErro } from "@/components/common/ErrorMessage";
import { Painel } from "@/components/common/Panel";
import { SeloStatus } from "@/components/common/StatusBadge";
import { Pagina } from "@/components/layout/Page";
import { HubDeAbas, useAbasDoHub } from "@/components/layout/TabHub";
import { Button } from "@/components/ui/button";

import { consultaEmpresa, consultaIntegracoes, consultaModulos } from "./api";
import { AbaDados } from "./components/DataTab";
import { AbaIntegracoes } from "./components/IntegrationsTab";
import { AbaModulos } from "./components/ModulesTab";
import { TOM_DO_STATUS } from "./texts";

export function PaginaEmpresa({
  id,
  aba,
  aoMudarAba,
}: {
  id: string;
  aba: string | undefined;
  aoMudarAba: (aba: string) => void;
}) {
  const consulta = useQuery(consultaEmpresa(id));
  const { visiveis, atual } = useAbasDoHub(ABAS_DA_EMPRESA, aba);
  const empresa = consulta.data;
  /** A aba consulta só quando aberta, com a empresa já carregada. */
  const aberta = (valor: string) => atual?.valor === valor && Boolean(empresa);
  const modulos = useQuery({ ...consultaModulos(id), enabled: aberta("modulos") });
  const integracoes = useQuery({ ...consultaIntegracoes(id), enabled: aberta("integracoes") });

  const titulo = (
    <span className="inline-flex flex-wrap items-center gap-3">
      {empresa?.nome ?? (consulta.isLoading ? "Carregando…" : "Empresa")}
      {empresa && (
        <SeloStatus tom={TOM_DO_STATUS[empresa.status]}>
          {ROTULO_DO_STATUS[empresa.status]}
        </SeloStatus>
      )}
    </span>
  );
  const voltar = (
    <Button asChild size="sm" variant="ghost">
      <Link to="/plataforma/empresas">
        <ArrowLeft aria-hidden />
        Empresas
      </Link>
    </Button>
  );

  if (!empresa) {
    return (
      <Pagina titulo={titulo} acoes={voltar}>
        {consulta.error && (
          <Painel>
            <MensagemErro erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()} />
          </Painel>
        )}
      </Pagina>
    );
  }

  return (
    <HubDeAbas
      titulo={titulo}
      rotulo="Abas da empresa"
      visiveis={visiveis}
      atual={atual}
      aoMudar={aoMudarAba}
      acoes={voltar}
    >
      {(a) => (
        <Pagina
          titulo={empresa.nome}
          descricao={
            <>
              {empresa.slug}
              {empresa.cnpj ? ` · CNPJ ${empresa.cnpj}` : ""}
            </>
          }
        >
          {a.valor === "dados" && <AbaDados empresa={empresa} />}
          {a.valor === "modulos" && (
            <AbaModulos
              empresaId={id}
              modulos={modulos.data?.modulos}
              carregando={modulos.isLoading}
              erro={modulos.error}
            />
          )}
          {a.valor === "integracoes" && (
            <AbaIntegracoes
              empresa={empresa}
              integracoes={integracoes.data?.integracoes}
              carregando={integracoes.isLoading}
              erro={integracoes.error}
            />
          )}
        </Pagina>
      )}
    </HubDeAbas>
  );
}
