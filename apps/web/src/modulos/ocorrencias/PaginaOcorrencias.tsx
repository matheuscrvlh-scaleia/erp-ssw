import { formatarCnpjCpf } from "@erp/dominio/nucleo";
import { hojeNoFuso } from "@erp/shared/datas";
import { formatarData, formatarInteiro, formatarParticipacao } from "@erp/shared/formatacao";
import { keepPreviousData, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  CircleHelp,
  ClipboardList,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useMemo } from "react";

import { consultaAcesso } from "@/acesso/sessao";
import { Aviso } from "@/componentes/comum/Aviso";
import { etiquetasQueLimpam, FiltrandoPor } from "@/componentes/comum/FiltrosAvancados";
import { KpiCard } from "@/componentes/comum/KpiCard";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { resolverPeriodo } from "@/componentes/comum/periodo";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { temFiltro } from "@/hooks/filtros-na-url";
import { useFiltrosNaUrl } from "@/hooks/use-filtros-na-url";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { SeloDosDados } from "@/modulos/ingestao-ssw/SeloDosDados";

import {
  carregarListaInteira,
  consultaConferentes,
  consultaLista,
  consultaOpcoes,
  consultaPainel,
} from "./api";
import { BlocosApoio, BlocosDestaque, ComparativoDoMes, ImpactoPorCodigo } from "./Blocos";
import {
  type BuscaOcorrencias,
  camposMantidosAoLimpar,
  esquemaDaBusca,
  etiquetasDaBusca,
  filtrosDeCteDaBusca,
  linkDaListagem,
  NAO_SAO_FILTRO,
  recortesDaBusca,
} from "./busca";
import { CodigosDoCard } from "./CodigosDoCard";
import { BarraDeFiltros } from "./Filtros";
import { ListaDeOcorrencias } from "./Lista";
import { rotulosDoResponsavel } from "./rotulos";

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
  const alternarCard = (resp: BuscaOcorrencias["resp"]) => {
    mudar({ resp: busca.resp === resp ? "todas" : resp });
  };
  const escolherCodigo = (codigo: number) => {
    mudar({ codigos: [codigo] });
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
          <BarraDeFiltros
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
              onClick={() => void navegar({ href: "/admin/codigos" })}
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          rotulo="Total de ocorrências"
          valor={formatarInteiro(m.total)}
          status="bom"
          neutro
          icone={ClipboardList}
          detalhe={`${formatarInteiro(m.ctrcs)} CT-e distintos`}
          dica={
            busca.campoData === "emissao"
              ? "Ocorrências dos CT-e com emissão dentro do período selecionado."
              : "Ocorrências dos CT-e com previsão de entrega dentro do período selecionado."
          }
          ativo={busca.resp === "todas"}
          aoClicar={() => {
            mudar({ resp: "todas" });
          }}
          extra={
            <CodigosDoCard
              card="todas"
              filtros={filtros}
              titulo="Todos os códigos do período"
              aoEscolher={escolherCodigo}
            />
          }
        />
        <KpiCard
          rotulo="Penalizantes"
          selo="CT-e distintos"
          status="ruim"
          icone={ShieldAlert}
          valor={formatarInteiro(m.penalizantes)}
          detalhe={`${formatarParticipacao(m.penalizantes, m.ctrcs)} dos CT-e`}
          dica={`CT-e com pelo menos uma ocorrência penalizante de responsabilidade da ${nomeCurto} (exclui responsável cliente) E que estão em atraso: não entregues, sem código finalizador e com prazo de entrega já vencido. Clique para filtrar a tela por eles.`}
          ativo={busca.resp === "penalizantes"}
          aoClicar={() => {
            alternarCard("penalizantes");
          }}
          extra={
            <CodigosDoCard
              card="penalizantes"
              filtros={filtros}
              titulo="Códigos dos CT-e penalizantes"
              aoEscolher={escolherCodigo}
            />
          }
        />
        <KpiCard
          rotulo="Não penalizantes"
          selo="CT-e distintos"
          status="bom"
          icone={ShieldCheck}
          valor={formatarInteiro(m.naoPenalizantes)}
          detalhe={`${formatarParticipacao(m.naoPenalizantes, m.ctrcs)} dos CT-e`}
          dica={`CT-e que não atendem às duas condições juntas: ou não tiveram ocorrência de responsabilidade da ${nomeCurto}, ou ainda estão dentro do prazo, ou já foram entregues ou baixados sem entrega. Clique para filtrar a tela por eles.`}
          ativo={busca.resp === "externas"}
          aoClicar={() => {
            alternarCard("externas");
          }}
          extra={
            <CodigosDoCard
              card="externas"
              filtros={filtros}
              titulo="Códigos dos CT-e não penalizantes"
              aoEscolher={escolherCodigo}
            />
          }
        />
        <KpiCard
          rotulo="Pendentes de classificação"
          valor={formatarInteiro(m.pendentes)}
          status="alerta"
          neutro={m.pendentes === 0}
          icone={CircleHelp}
          detalhe={`${formatarParticipacao(m.pendentes, m.total)} das ocorrências`}
          dica="Códigos sem cadastro, ou marcados como pendentes de classificação. Não entram em penalizantes nem em não penalizantes. Clique para filtrar a tela por eles."
          ativo={busca.resp === "pendentes"}
          aoClicar={() => {
            alternarCard("pendentes");
          }}
          extra={
            <CodigosDoCard
              card="pendentes"
              filtros={filtros}
              titulo="Códigos pendentes de classificação"
              aoEscolher={escolherCodigo}
            />
          }
        />
      </div>

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
