import { type EmpresaCompleta } from "@erp/shared/contratos/plataforma";
import { ROTULO_DO_STATUS } from "@erp/shared/plataforma";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowLeftRight } from "lucide-react";
import { type ComponentType, useState } from "react";
import { toast } from "sonner";

import { ABAS_DA_EMPRESA } from "@/acesso/navegacao";
import { consultaAcesso, trocarEmpresa } from "@/acesso/sessao";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { HubDeAbas, useAbasDoHub } from "@/componentes/layout/HubDeAbas";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { useAlteracoes, useLogsComAbas } from "@/modulos/admin/logs/Logs";
import { PaginaAhgora } from "@/modulos/ahgora/PaginaAhgora";
import { PaginaImportacaoSsw } from "@/modulos/ingestao/PaginaImportacaoSsw";
import { PaginaXmlCte } from "@/modulos/ingestao/PaginaXmlCte";
import { PaginaDiagnostico } from "@/modulos/ingestao-ssw/PaginaDiagnostico";
import { PaginaIngestao } from "@/modulos/ingestao-ssw/PaginaIngestao";

import { AbaDados } from "./AbaDados";
import { AbaImplantacao, AbaIntegracoes, AbaModulos, AbaUsuarios } from "./AbasDaEmpresa";
import { consultaEmpresa, consultaEmpresas } from "./api";
import { TOM_DO_STATUS } from "./PaginaEmpresas";

const CONTEUDO_NA_EMPRESA_ATIVA: Record<string, ComponentType> = {
  ingestao: PaginaIngestao,
  "importacao-ssw": PaginaImportacaoSsw,
  "xml-cte": PaginaXmlCte,
  ahgora: PaginaAhgora,
  diagnostico: PaginaDiagnostico,
};

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
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const { visiveis, atual } = useAbasDoHub(ABAS_DA_EMPRESA, aba);
  const empresa = consulta.data;
  // Os filtros dos logs ficam na barra de filtros da página, como nas outras telas.
  const logs = useLogsComAbas({
    empresaId: id,
    ativo: atual?.valor === "logs" && Boolean(empresa),
  });

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

  const NaEmpresaAtiva = atual && CONTEUDO_NA_EMPRESA_ATIVA[atual.valor];
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
            {a.valor === "modulos" && <AbaModulos empresaId={id} />}
            {a.valor === "usuarios" && <AbaUsuarios empresaId={id} />}
            {a.valor === "integracoes" && <AbaIntegracoes empresaId={id} />}
            {a.valor === "logs" && logs.conteudo}
            {a.valor === "implantacao" && <AbaImplantacao empresa={empresa} />}
          </Pagina>
        )
      }
    </HubDeAbas>
  );
}

/**
 * Ingestão, importação, Ahgora e Diagnóstico SSW leem e gravam na empresa ativa da sessão (o token
 * leva a empresa). Para operar a empresa aberta, a pessoa troca a empresa ativa com um clique; a
 * página recarrega já nela. Nada troca sozinho: a troca vale para a sessão inteira.
 */
function TrocarParaAEmpresa({
  empresa,
  ativa,
}: {
  empresa: EmpresaCompleta;
  ativa: string | null;
}) {
  const queryClient = useQueryClient();
  const [trocando, setTrocando] = useState(false);
  const usar = async () => {
    setTrocando(true);
    try {
      await trocarEmpresa(empresa.id, queryClient);
    } catch (e) {
      toast.error(mensagemAmigavel(e, "Não foi possível trocar de empresa."));
      setTrocando(false);
    }
  };
  return (
    <Pagina titulo={empresa.nome}>
      <Painel>
        <EstadoVazio
          icone={ArrowLeftRight}
          mensagem={`Esta aba opera na empresa ativa da sessão${ativa ? `, hoje ${ativa}` : ""}.`}
          detalhe={`Para ver e operar ${empresa.nome}, troque a empresa ativa. O menu e as outras telas também passam a mostrar ${empresa.nome}.`}
          acao={
            <Button size="sm" onClick={() => void usar()} disabled={trocando}>
              <ArrowLeftRight aria-hidden />
              {trocando ? "Trocando…" : `Usar ${empresa.nome}`}
            </Button>
          }
        />
      </Painel>
    </Pagina>
  );
}

export function PaginaLogsDaPlataforma() {
  const empresas = useQuery(consultaEmpresas);
  const alteracoes = useAlteracoes({
    empresas: (empresas.data?.empresas ?? []).map((e) => ({ id: e.id, nome: e.nome })),
  });
  return (
    <Pagina
      titulo="Logs"
      descricao="O que mudou em todas as empresas e na Plataforma, quem mudou e quando. Clique numa linha para ver o antes e o depois."
      filtros={alteracoes.filtros}
    >
      {alteracoes.conteudo}
    </Pagina>
  );
}
