import { ROTULO_DO_STATUS } from "@erp/shared/platform";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { type ComponentType, type ReactNode } from "react";

import { ABAS_DA_EMPRESA } from "@/access/navigation";
import { consultaAcesso } from "@/access/session";
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
import { TrocarParaAEmpresa } from "./components/SwitchToCompany";
import { TOM_DO_STATUS } from "./texts";

/** Logs das integrações de uma empresa: o alternador da integração, os filtros e a tabela. */
interface LogsDaEmpresa {
  alternador: ReactNode;
  filtros: ReactNode;
  conteudo: ReactNode;
}

export function PaginaEmpresa({
  id,
  aba,
  aoMudarAba,
  naEmpresaAtiva,
  useLogsDasIntegracoes,
}: {
  id: string;
  aba: string | undefined;
  aoMudarAba: (aba: string) => void;
  /**
   * Abas que são telas de outros módulos (ingestão, importação, diagnóstico), por valor da aba.
   * Operam na empresa ativa da sessão; a rota é quem as monta.
   */
  naEmpresaAtiva: Readonly<Record<string, ComponentType>>;
  /**
   * Hook dos logs das integrações (do admin), entregue pela rota. É chamado aqui, e não na aba,
   * para os filtros dos logs continuarem ao trocar de aba.
   */
  useLogsDasIntegracoes: (empresaId: string, ativo: boolean) => LogsDaEmpresa;
}) {
  const consulta = useQuery(consultaEmpresa(id));
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const { visiveis, atual } = useAbasDoHub(ABAS_DA_EMPRESA, aba);
  const empresa = consulta.data;
  /** A aba consulta só quando aberta, com a empresa já carregada. */
  const aberta = (valor: string) => atual?.valor === valor && Boolean(empresa);
  // Os filtros dos logs ficam na barra de filtros da página, como nas outras telas.
  const logs = useLogsDasIntegracoes(id, aberta("logs"));
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

  const NaEmpresaAtiva = atual && naEmpresaAtiva[atual.valor];
  const ehAAtiva = acesso.empresa?.id === id;
  return (
    <HubDeAbas
      titulo={titulo}
      rotulo="Abas da empresa"
      visiveis={visiveis}
      atual={atual}
      aoMudar={aoMudarAba}
      acoes={voltar}
      meta={
        NaEmpresaAtiva &&
        ehAAtiva && <SeloStatus tom="info">Empresa ativa da sessão: {empresa.nome}</SeloStatus>
      }
    >
      {(a) =>
        NaEmpresaAtiva ? (
          ehAAtiva ? (
            <NaEmpresaAtiva />
          ) : (
            <TrocarParaAEmpresa empresa={empresa} ativa={acesso.empresa?.nome ?? null} />
          )
        ) : (
          <Pagina
            titulo={empresa.nome}
            descricao={
              <>
                {empresa.slug}
                {empresa.cnpj ? ` · CNPJ ${empresa.cnpj}` : ""}
              </>
            }
            filtros={
              a.valor === "logs" && (
                <div className="flex flex-wrap items-center gap-2">
                  {logs.alternador}
                  {logs.filtros}
                </div>
              )
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
                empresaId={id}
                integracoes={integracoes.data?.integracoes}
                carregando={integracoes.isLoading}
                erro={integracoes.error}
              />
            )}
            {a.valor === "logs" && logs.conteudo}
          </Pagina>
        )
      }
    </HubDeAbas>
  );
}
