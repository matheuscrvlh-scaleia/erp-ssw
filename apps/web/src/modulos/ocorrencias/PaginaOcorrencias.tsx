import { formatarCnpjCpf } from "@erp/dominio/nucleo";
import { hojeNoFuso } from "@erp/shared/datas";
import { formatarData, formatarInteiro, formatarParticipacao } from "@erp/shared/formatacao";
import { keepPreviousData, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useMemo } from "react";

import { consultaAcesso } from "@/acesso/sessao";
import { etiquetasQueLimpam, FiltrandoPor } from "@/componentes/comum/FiltrosAvancados";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { resolverPeriodo } from "@/componentes/comum/periodo";
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
import { CartaoDeMetrica, CodigosDoCard } from "./Cartoes";
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
    <div className="space-y-4 text-[14px]">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Ocorrências</h1>
          <SeloDosDados />
          <p className="mt-0.5 text-[13px] font-medium text-muted-foreground">
            Investigue causas e identifique qual unidade precisa atuar
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          disabled={buscando}
          onClick={() => {
            void painel.refetch();
            void lista.refetch();
          }}
        >
          <RefreshCw className={`mr-1.5 h-3 w-3 ${buscando ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </header>

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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CartaoDeMetrica
          rotulo="Total de ocorrências"
          valor={formatarInteiro(m.total)}
          apoio={`${formatarInteiro(m.ctrcs)} CT-e distintos`}
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
        <CartaoDeMetrica
          rotulo="Penalizantes"
          selo="CT-e distintos"
          tom="ruim"
          valor={formatarInteiro(m.penalizantes)}
          apoio={`${formatarParticipacao(m.penalizantes, m.ctrcs)} dos CT-e`}
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
        <CartaoDeMetrica
          rotulo="Não penalizantes"
          selo="CT-e distintos"
          valor={formatarInteiro(m.naoPenalizantes)}
          apoio={`${formatarParticipacao(m.naoPenalizantes, m.ctrcs)} dos CT-e`}
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
        <CartaoDeMetrica
          rotulo="Pendentes de classificação"
          valor={formatarInteiro(m.pendentes)}
          apoio={`${formatarParticipacao(m.pendentes, m.total)} das ocorrências`}
          tom={m.pendentes > 0 ? "alerta" : "normal"}
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

      {m.pendentes > 0 && (
        <div className="flex items-center gap-2 rounded-[10px] border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] font-medium text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>
            <strong>{formatarInteiro(m.pendentes)}</strong> ocorrência(s) precisam ser classificadas
            para os números ficarem 100% exatos.
          </span>
          <button
            type="button"
            onClick={() => void navegar({ href: "/admin/codigos" })}
            className="ml-auto rounded-md border border-amber-400 px-2 py-0.5 text-[12px] font-semibold hover:bg-amber-100"
          >
            Classificar agora →
          </button>
        </div>
      )}

      {painel.error && (
        <MensagemErro
          erro={painel.error}
          aoTentarDeNovo={() => {
            void painel.refetch();
          }}
        />
      )}

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
    </div>
  );
}
