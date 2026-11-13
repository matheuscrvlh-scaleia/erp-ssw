import { formatarCnpjCpf } from "@erp/domain/core";
import { hojeNoFuso } from "@erp/shared/dates";
import { formatarData, formatarInteiro } from "@erp/shared/formatting";
import { keepPreviousData, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useMemo } from "react";

import { consultaAcesso } from "@/access/session";
import { etiquetasQueLimpam, FiltrandoPor } from "@/components/common/AdvancedFilters";
import { MensagemErro } from "@/components/common/ErrorMessage";
import { Aviso } from "@/components/common/Notice";
import { resolverPeriodo } from "@/components/common/period";
import { SeloDosDados } from "@/components/layout/DataBadge";
import { Pagina } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { temFiltro } from "@/hooks/url-filters";
import { useFusoDaEmpresa } from "@/hooks/use-company-timezone";
import { useFiltrosNaUrl } from "@/hooks/use-url-filters";

import {
  carregarListaInteira,
  consultaConferentes,
  consultaLista,
  consultaOpcoes,
  consultaPainel,
} from "./api";
import { CardsDoPainel } from "./components/DashboardCards";
import { BlocosDestaque } from "./components/HighlightBlocks";
import { ImpactoPorCodigo } from "./components/ImpactByCode";
import { ComparativoDoMes } from "./components/MonthComparison";
import { FiltrosOcorrencias } from "./components/OccurrencesFilters";
import { ListaDeOcorrencias } from "./components/OccurrencesList";
import { BlocosApoio } from "./components/SupportBlocks";
import {
  type BuscaOcorrencias,
  camposMantidosAoLimpar,
  esquemaDaBusca,
  etiquetasDaBusca,
  filtrosDeCteDaBusca,
  linkDaListagem,
  NAO_SAO_FILTRO,
  recortesDaBusca,
} from "./search";
import { rotulosDoResponsavel } from "./texts";

export function PaginaOcorrencias() {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const fuso = useFusoDaEmpresa();
  const nomeCurto = acesso.empresa?.nomeCurto ?? "FR";
  const rotulos = rotulosDoResponsavel(nomeCurto);
  const { filtros: busca, definir, limpar, ativos } = useFiltrosNaUrl(esquemaDaBusca);
  const navegar = useNavigate();
  const periodo = resolverPeriodo(busca.periodo, busca.de, busca.ate, hojeNoFuso(fuso));
  const filtros = filtrosDeCteDaBusca(busca, periodo);
  const recortes = recortesDaBusca(busca);
  const entradaDaLista = {
    ...filtros,
    ...recortes,
    ordem: busca.ordem,
    direcao: busca.dir,
    pagina: busca.page,
    tamanho: busca.size,
  };

  const painel = useQuery(consultaPainel({ ...filtros, ...recortes }));
  const lista = useQuery({ ...consultaLista(entradaDaLista), placeholderData: keepPreviousData });
  const opcoes = useQuery(
    consultaOpcoes({
      inicio: periodo.inicio,
      fim: periodo.fim,
      unidades: busca.unidades,
      filiais: busca.filiais,
    }),
  );
  const conferentes = useQuery(consultaConferentes);

  /** Toda mudança de filtro volta para a página 1. */
  const mudar = (m: Partial<BuscaOcorrencias>) => {
    definir({ page: 1, ...m });
  };

  const opcoesDosFiltros = useMemo(
    () => ({
      parceiros: opcoes.data?.parceiros,
      codigos: opcoes.data?.codigos.map((c) => ({
        valor: String(c.codigo),
        rotulo: `#${String(c.codigo)} ${c.descricao}`,
      })),
      conferentes: conferentes.data?.conferentes.map((c) => ({ valor: c, rotulo: c })),
    }),
    [opcoes.data, conferentes.data],
  );

  const etiquetas = etiquetasQueLimpam(
    etiquetasDaBusca(busca, {
      parceiro: (cnpj) =>
        opcoes.data?.parceiros.find((p) => p.id === cnpj)?.nome ??
        formatarCnpjCpf(cnpj) ??
        undefined,
      unidade: (id) => opcoes.data?.unidades.find((u) => u.id === id)?.nome,
      codigo: (codigo) => opcoes.data?.codigos.find((c) => c.codigo === codigo)?.descricao,
      responsavel: (r) => rotulos[r],
    }),
    mudar,
  );

  const m = painel.data?.metricas ?? {
    total: 0,
    pendentes: 0,
    ctrcs: 0,
    penalizantes: 0,
    naoPenalizantes: 0,
  };
  const recortesDosBlocos = {
    prazo: busca.prazo,
    faixa: busca.faixa,
    pagador: busca.pagador,
    codigo: busca.codigos.length === 1 ? (busca.codigos[0] ?? null) : null,
    unidadeResp: busca.unidadeResp,
    aoPrazo: (prazo: BuscaOcorrencias["prazo"]) => {
      mudar({ prazo });
    },
    aoFaixa: (faixa: BuscaOcorrencias["faixa"]) => {
      mudar({ faixa });
    },
    aoPagador: (pagador: string | null) => {
      mudar({ pagador });
    },
    aoCodigo: (codigo: number | null) => {
      mudar({ codigos: codigo === null ? [] : [codigo] });
    },
    aoUnidadeResp: (unidadeResp: string | null) => {
      mudar({ unidadeResp });
    },
    aoFinalizacao: (tipo: Parameters<typeof linkDaListagem>[2]) => {
      void navegar({ href: linkDaListagem(busca, periodo, tipo) });
    },
  };
  const buscando = painel.isFetching || lista.isFetching;

  return (
    <Pagina
      titulo="Ocorrências"
      descricao="Investigue causas e identifique qual unidade precisa atuar"
      meta={<SeloDosDados className="" />}
      acoes={
        <Button
          size="sm"
          variant="ghost"
          disabled={buscando}
          onClick={() => {
            void painel.refetch();
            void lista.refetch();
          }}
        >
          <RefreshCw className={buscando ? "animate-spin" : undefined} aria-hidden />
          Atualizar
        </Button>
      }
      filtros={
        <>
          <FiltrosOcorrencias
            busca={busca}
            periodo={periodo}
            opcoes={opcoesDosFiltros}
            codigosAcompanhados={painel.data?.codigosAcompanhados ?? null}
            nomeCurto={nomeCurto}
            filtrando={temFiltro(ativos, busca.periodo, NAO_SAO_FILTRO)}
            mudar={mudar}
            aoLimpar={() => {
              limpar(camposMantidosAoLimpar(busca));
            }}
          />
          <FiltrandoPor etiquetas={etiquetas} />
        </>
      }
    >
      {m.pendentes > 0 && (
        <Aviso
          tom="alerta"
          acao={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void navegar({ href: "/admin/configuracoes?aba=codigos" })}
            >
              Classificar agora
              <ArrowRight aria-hidden />
            </Button>
          }
        >
          <strong>{formatarInteiro(m.pendentes)}</strong> ocorrência(s) precisam ser classificadas
          para os números ficarem 100% exatos.
        </Aviso>
      )}
      {painel.error && (
        <MensagemErro
          erro={painel.error}
          aoTentarDeNovo={() => {
            void painel.refetch();
          }}
        />
      )}

      <CardsDoPainel
        metricas={m}
        busca={busca}
        filtros={filtros}
        nomeCurto={nomeCurto}
        mudar={mudar}
      />

      <ComparativoDoMes
        painel={painel.data}
        carregando={painel.isLoading}
        periodo={periodo}
        r={recortesDosBlocos}
      />
      <BlocosDestaque
        painel={painel.data}
        carregando={painel.isLoading}
        nomeCurto={nomeCurto}
        r={recortesDosBlocos}
      />
      <ImpactoPorCodigo
        painel={painel.data}
        carregando={painel.isLoading}
        campoData={busca.campoData}
        r={recortesDosBlocos}
      />
      <BlocosApoio painel={painel.data} carregando={painel.isLoading} r={recortesDosBlocos} />

      <ListaDeOcorrencias
        busca={busca}
        linhas={lista.data?.linhas ?? []}
        total={lista.data?.total ?? 0}
        carregando={lista.isLoading}
        erro={lista.error}
        nomeCurto={nomeCurto}
        subtitulo={`${formatarData(periodo.inicio)} a ${formatarData(periodo.fim)}`}
        carregarTodas={() => carregarListaInteira(entradaDaLista)}
        aoTentarDeNovo={() => {
          void lista.refetch();
        }}
        aoOrdenar={(ordem, dir) => {
          mudar({ ordem, dir });
        }}
        aoMudarPagina={(page) => {
          definir({ page });
        }}
        aoMudarTamanho={(size) => {
          mudar({ size });
        }}
        aoAbrirCte={(numero) => void navegar({ href: `/ctrc/${encodeURIComponent(numero)}` })}
      />
    </Pagina>
  );
}
