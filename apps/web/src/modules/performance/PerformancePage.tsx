import { montarBloco } from "@erp/domain/performance/report";
import { resolverPeriodo } from "@erp/domain/performance/screen";
import { janelaDaSerie } from "@erp/domain/performance/series";
import { diferencaEmDias, hojeNoFuso } from "@erp/shared/dates";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { consultaAcesso } from "@/access/session";
import { GraficoSerie } from "@/components/common/SeriesChart";
import { SeloDosDados } from "@/components/layout/DataBadge";
import { Pagina, Secao } from "@/components/layout/Page";
import { useFusoDaEmpresa } from "@/hooks/use-company-timezone";
import { consultaPagadores } from "@/modules/filters/api";

import {
  carregarExportacao,
  chaves,
  consultaAlertas,
  consultaCodigosDisponiveis,
  consultaConfiguracao,
  consultaOtif,
  consultaPontualidade,
  consultaPrevistos,
  consultaResumo,
  consultaSerie,
  consultaTde,
  consultaTiposNoPeriodo,
  entradaDoFiltro,
} from "./api";
import { BannerDeAlertas } from "./components/AlertsBanner";
import { EsqueletoDeCards } from "./components/CardsSkeleton";
import { type CliqueNosPrevistos, SecaoPrevistos } from "./components/ForecastSection";
import { LinhaDeKpis } from "./components/KpiRow";
import { VerificacaoDaParticao } from "./components/PartitionCheck";
import { AcoesDaPerformance } from "./components/PerformanceActions";
import { FiltrosPerformance } from "./components/PerformanceFilters";
import { AvisosDaPerformance } from "./components/PerformanceNotices";
import { type CardDeProducao, LinhaDeProducao } from "./components/ProductionLine";
import { ModalDeRelatorio } from "./components/ReportModal";
import { TabelaDeUnidades } from "./components/UnitsTable";
import { cartoesDeAlerta, extraDoAlerta, linhasDasUnidades, nomesConhecidos } from "./rules";
import {
  type BuscaPerformance,
  enderecoDaLista,
  type ExtraDaLista,
  filtrosDaBusca,
  limparFiltros,
  type TipoDaLista,
} from "./search";

const rota = getRouteApi("/_authenticated/performance/");

const PADRAO = {
  slaMetaPct: 95,
  slaAlertaAmareloPct: 90,
  taxaRetornoMetaPct: 3,
  otifVisivel: false,
};
const CARD_PARA_LISTA: Record<CardDeProducao, TipoDaLista> = {
  emitidos: "emitidos",
  entregues: "entregues",
  no_prazo: "no_prazo",
  fora_prazo: "fora_prazo",
  finalizado_sistema: "finalizado_sistema",
  producao_pct: "entregues",
  tde: "tde_aguardando",
};

/** Liga quando o elemento entra na tela (o gráfico fica no pé e só consulta ao rolar). */
function useVisivel<E extends Element>(): [React.RefObject<E | null>, boolean] {
  const ref = useRef<E>(null);
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || visivel) return;
    const observador = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) setVisivel(true);
    });
    observador.observe(el);
    return () => {
      observador.disconnect();
    };
  }, [visivel]);
  return [ref, visivel];
}

export function PaginaPerformance() {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const nomeCurto = acesso.empresa?.nomeCurto ?? "";
  const fuso = useFusoDaEmpresa();
  const busca = rota.useSearch();
  const navegarNaTela = rota.useNavigate();
  const navegar = useNavigate();
  const queryClient = useQueryClient();
  const mudar = (patch: Partial<BuscaPerformance>) =>
    void navegarNaTela({ search: (atual) => ({ ...atual, ...patch }) });

  const periodo = resolverPeriodo(busca.periodo, busca.de, busca.ate, hojeNoFuso(fuso));
  const filtros = useMemo(() => filtrosDaBusca(busca), [busca]);
  const entrada = entradaDoFiltro(periodo, filtros, busca.base);
  const porEmissao = entradaDoFiltro(periodo, filtros, "emissao");

  const configuracao = useQuery(consultaConfiguracao).data ?? PADRAO;
  const resumo = useQuery(consultaResumo(entrada));
  const r = resumo.data;
  const pont = useQuery({ ...consultaPontualidade(entrada), enabled: !!r });
  const otif = useQuery({
    ...consultaOtif(entrada),
    enabled: configuracao.otifVisivel && !!r && pont.isFetched,
  });
  const tde = useQuery({ ...consultaTde(entrada), enabled: !!r });
  const liberadoDepois = !!r && pont.isFetched;
  // Alerta "abaixo da meta" usa o SLA Op. por emissão (mesma chave quando a base já é emissão).
  const pontEmissao = useQuery({ ...consultaPontualidade(porEmissao), enabled: liberadoDepois });
  const alertas = useQuery({ ...consultaAlertas(porEmissao), enabled: liberadoDepois });
  const [ignorarPeriodo, setIgnorarPeriodo] = useState(false);
  const previstos = useQuery({
    ...consultaPrevistos({ ...porEmissao, ignorarPeriodo }),
    enabled: liberadoDepois,
  });
  const pagadores = useQuery({
    ...consultaPagadores({
      ...periodo,
      unidades: filtros.unidades ?? undefined,
      filiais: filtros.filiais ?? undefined,
    }),
    enabled: !!r,
  });

  const [ocorrenciaAberta, setOcorrenciaAberta] = useState(false);
  const [tipoAberto, setTipoAberto] = useState(false);
  const codigos = useQuery({
    ...consultaCodigosDisponiveis(entrada),
    enabled: ocorrenciaAberta || busca.codigos.length > 0,
  });
  const tiposNoPeriodo = useQuery({ ...consultaTiposNoPeriodo(entrada), enabled: tipoAberto });

  const janela = janelaDaSerie(periodo.inicio, periodo.fim);
  const [refSerie, serieVisivel] = useVisivel<HTMLDivElement>();
  const serie = useQuery({
    ...consultaSerie({
      ...entrada,
      inicio: janela.inicio,
      fim: janela.fim,
      granularidade: janela.granularidade,
    }),
    enabled: liberadoDepois && serieVisivel,
  });

  const [relatorioAberto, setRelatorioAberto] = useState(false);

  const abrirLista = (tipo: TipoDaLista, extra?: ExtraDaLista) =>
    void navegar({ href: enderecoDaLista(busca, tipo, extra) });

  const bloco = useMemo(
    () => (r && pont.data ? montarBloco(r.producao, r.totais, pont.data) : undefined),
    [r, pont.data],
  );
  const slaPorSigla = useMemo(
    () => new Map((pont.data?.porUnidade ?? []).map((u) => [u.sigla, u])),
    [pont.data],
  );
  const linhas = useMemo(
    () => linhasDasUnidades(r?.porUnidade ?? [], slaPorSigla, busca.ordem),
    [r, slaPorSigla, busca.ordem],
  );

  const cliqueNosPrevistos = (c: CliqueNosPrevistos) => {
    abrirLista(c.eixo === "faixa" ? "previstos_por_faixa" : "previstos_por_status", {
      ...(c.eixo === "status" ? { statusPrevisto: c.chave } : {}),
      ...(c.eixo === "faixa" ? { faixaPrev: c.chave } : {}),
      ignorarPeriodo,
      base: "emissao",
    });
  };

  const erro = resumo.error ?? pont.error;
  const dias = diferencaEmDias(periodo.inicio, periodo.fim) + 1;

  return (
    <Pagina
      titulo={busca.periodo === "hoje" ? "Performance do dia" : `Performance — ${periodo.rotulo}`}
      descricao="Entregas e SLA por unidade no período"
      meta={<SeloDosDados className="" />}
      acoes={
        <AcoesDaPerformance
          otifVisivel={configuracao.otifVisivel}
          nomeCurto={nomeCurto}
          atualizando={resumo.isFetching}
          aoAtualizar={() => void queryClient.invalidateQueries({ queryKey: chaves.tudo })}
          arquivo={`performance-${busca.periodo}`}
          subtitulo={`${periodo.inicio} → ${periodo.fim}`}
          exportar={() => carregarExportacao(entrada)}
          relatorioAberto={relatorioAberto}
          aoAlternarRelatorio={() => {
            setRelatorioAberto((v) => !v);
          }}
        />
      }
      filtros={
        <FiltrosPerformance
          busca={busca}
          periodo={periodo}
          mudar={mudar}
          aoLimpar={() => void navegarNaTela({ search: limparFiltros(busca) })}
          unidades={r?.unidades}
          pagadores={pagadores.data}
          codigos={codigos.data}
          aoAbrirOcorrencia={setOcorrenciaAberta}
          tiposNoPeriodo={tiposNoPeriodo.data}
          aoAbrirTipo={setTipoAberto}
          abrirLista={abrirLista}
        />
      }
    >
      <AvisosDaPerformance erro={erro} dias={dias} periodo={periodo} resumo={r} />

      {alertas.data && (
        <BannerDeAlertas
          cartoes={cartoesDeAlerta(alertas.data, pontEmissao.data?.porUnidade ?? [], nomeCurto)}
          onClique={(c) => {
            abrirLista(c.lista, extraDoAlerta(c));
          }}
        />
      )}

      {r ? (
        <LinhaDeKpis
          resumo={r}
          pontualidade={pont.data}
          otif={otif.data}
          configuracao={configuracao}
          nomeCurto={nomeCurto}
          acoes={{
            emAtraso: () => {
              abrirLista("em_atraso");
            },
            emAtrasoFr: () => {
              abrirLista("em_atraso_fr");
            },
            emAtrasoCliente: () => {
              abrirLista("em_atraso_cliente");
            },
            nascidos: () => {
              abrirLista("nascido_em_atraso");
            },
            otif: () => {
              abrirLista("otif");
            },
          }}
        />
      ) : (
        <EsqueletoDeCards quantos={5} />
      )}

      <Secao titulo="Produção">
        {bloco ? (
          <LinhaDeProducao
            bloco={bloco}
            tde={tde.data}
            slaMetaPct={configuracao.slaMetaPct}
            onCard={(card) => {
              abrirLista(CARD_PARA_LISTA[card]);
            }}
          />
        ) : (
          <EsqueletoDeCards quantos={7} />
        )}
      </Secao>

      <div ref={refSerie}>
        <GraficoSerie
          titulo={`Evolução ${janela.granularidade === "mes" ? "mês a mês" : "dia a dia"}`}
          subtitulo={
            janela.ampliada
              ? "Últimos 7 dias (o período selecionado é curto demais para um gráfico)"
              : `${periodo.rotulo} · mesmos filtros da tela`
          }
          pontos={serie.data}
          granularidade={janela.granularidade}
          metricas={["sla_op", "sla_cli", "volume"]}
          meta={configuracao.slaMetaPct / 100}
          carregando={serie.isFetching || (!serie.data && !serie.error)}
          erro={serie.error}
          nomeExport="performance-evolucao"
        />
      </div>

      <TabelaDeUnidades
        linhas={linhas}
        ordem={busca.ordem}
        carregando={resumo.isFetching}
        periodo={periodo}
        meta={configuracao.slaMetaPct / 100}
        alerta={configuracao.slaAlertaAmareloPct / 100}
        onInverterOrdem={() => {
          mudar({ ordem: busca.ordem === "pior" ? "melhor" : "pior" });
        }}
        onUnidade={(sigla) => {
          abrirLista("emitidos", { unidades: [sigla] });
        }}
        onPenalizados={(sigla) => {
          abrirLista("penalizados_abertos", { unidades: [sigla] });
        }}
      />

      <SecaoPrevistos
        dados={previstos.data}
        carregando={previstos.isFetching}
        ignorarPeriodo={ignorarPeriodo}
        onIgnorarPeriodo={setIgnorarPeriodo}
        onClique={cliqueNosPrevistos}
        rodape={bloco && <VerificacaoDaParticao bloco={bloco} ignorarPeriodo={ignorarPeriodo} />}
      />

      <ModalDeRelatorio
        aberto={relatorioAberto}
        onAberto={setRelatorioAberto}
        fuso={fuso}
        empresa={nomeCurto}
        herdados={{
          entrada: filtros,
          codigos: busca.codigos,
          // Unidade ou parceiro sem nome fica de fora do relatório, como hoje.
          filtros: {
            unidades: nomesConhecidos(busca.unidades, r?.unidades),
            parceiros: nomesConhecidos(busca.parceiros, pagadores.data),
            remetente: busca.remetente,
            destino: busca.destino,
            filiais: busca.filiais,
            codigos: busca.codigos,
          },
        }}
      />
    </Pagina>
  );
}
