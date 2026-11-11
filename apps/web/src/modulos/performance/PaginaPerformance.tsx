import { montarBloco } from "@erp/dominio/performance/relatorio";
import { janelaDaSerie } from "@erp/dominio/performance/serie";
import {
  ordenarCodigosDisponiveis,
  ordenarUnidades,
  resolverPeriodo,
} from "@erp/dominio/performance/tela";
import {
  type BaseDeData,
  BASES_DE_DATA,
  contratosPerformance,
  SEM_TIPO_DOCUMENTO,
} from "@erp/shared/contratos/performance";
import { diferencaEmDias, hojeNoFuso } from "@erp/shared/datas";
import { lerFiltroTexto } from "@erp/shared/filtro-texto";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { ArrowRight, FileBarChart, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { consultaAcesso } from "@/acesso/sessao";
import { Alternador } from "@/componentes/comum/Alternador";
import { Aviso } from "@/componentes/comum/Aviso";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";
import { FiltroPeriodo } from "@/componentes/comum/FiltroPeriodo";
import {
  type EtiquetaFiltroOpcional,
  FiltrandoPor,
  FiltrosAvancados,
  resumirNomes,
} from "@/componentes/comum/FiltrosAvancados";
import { Pagina, Secao } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { consultaPagadores } from "@/modulos/filtros/api";
import {
  BuscaDocumento,
  SeletorDeFilial,
  SeletorDePagador,
  SeletorDeTexto,
  SeletorDeTipoDocumento,
} from "@/modulos/filtros/componentes";
import { SeloDosDados } from "@/modulos/ingestao-ssw/SeloDosDados";

import { cartoesDeAlerta } from "./alertas";
import {
  CHAVE_DA_PERFORMANCE,
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
import { BannerDeAlertas } from "./BannerDeAlertas";
import {
  BASE_CURTA,
  type BuscaPerformance,
  DATA_DA_BASE,
  DICA_DA_BASE,
  enderecoDaLista,
  type ExtraDaLista,
  filtrosDaBusca,
  limparFiltros,
  ROTULO_DA_BASE,
  temFiltroLimpavel,
  type TipoDaLista,
} from "./busca";
import { ComoFuncionaPerformance } from "./ComoFuncionaPerformance";
import { COLUNAS_DA_EXPORTACAO } from "./exportacao";
import { GraficoSerie } from "./GraficoSerie";
import { EsqueletoDeCards, LinhaDeKpis } from "./Kpis";
import { type CliqueNosPrevistos, SecaoPrevistos } from "./Previstos";
import { type CardDeProducao, LinhaDeProducao, VerificacaoDaParticao } from "./Producao";
import { nomesConhecidos } from "./relatorio";
import { DialogoRelatorio } from "./RelatorioPeriodo";
import { TabelaDeUnidades } from "./TabelaUnidades";

const rota = getRouteApi("/_autenticado/performance/");

const PADRAO = {
  slaMetaPct: 95,
  slaAlertaAmareloPct: 90,
  taxaRetornoMetaPct: 3,
  otifVisivel: false,
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
  // Contexto dos seletores compartilhados (sugestões e unidade responsável).
  const contexto = {
    ...periodo,
    parceiros: busca.parceiros,
    remetente: busca.remetente,
    destino: busca.destino,
    filiais: busca.filiais,
    codigos: busca.codigos.map(Number).filter((n) => Number.isInteger(n)),
  };

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
    () =>
      ordenarUnidades(
        r?.porUnidade ?? [],
        new Map([...slaPorSigla].map(([s, u]) => [s, u.performancePct])),
        busca.ordem,
      ).map((u) => ({
        ...u,
        slaOp: slaPorSigla.get(u.sigla)?.performancePct ?? null,
        nascidosPct: slaPorSigla.get(u.sigla)?.nascidosPct ?? null,
      })),
    [r, slaPorSigla, busca.ordem],
  );

  // "Filtrando por": nomes, nunca ids.
  const nomesUnidades = busca.unidades.map(
    (id) =>
      r?.unidades.find((u) => u.id === id)?.nome ?? (UUID.test(id) ? "unidade selecionada" : id),
  );
  const nomesParceiros = busca.parceiros.map(
    (cnpj) => pagadores.data?.find((p) => p.id === cnpj)?.nome ?? cnpj,
  );
  const nomesCodigos = busca.codigos.map((cod) => {
    const descricao = codigos.data?.find((o) => o.codigo === cod)?.descricao;
    return descricao ? `${cod} — ${descricao}` : cod;
  });
  const nomesTipos = busca.tipos.map((t) => (t === SEM_TIPO_DOCUMENTO ? "sem tipo" : t));
  const etiquetas: EtiquetaFiltroOpcional[] = [
    nomesUnidades.length > 0 && {
      rotulo: "Unidade",
      ...resumirNomes(nomesUnidades),
      limpar: () => {
        mudar({ unidades: [] });
      },
    },
    nomesParceiros.length > 0 && {
      rotulo: "Parceiros",
      ...resumirNomes(nomesParceiros),
      limpar: () => {
        mudar({ parceiros: [] });
      },
    },
    busca.filiais.length > 0 && {
      rotulo: "Unidade responsável",
      ...resumirNomes(busca.filiais),
      limpar: () => {
        mudar({ filiais: [] });
      },
    },
    busca.remetente.trim() && {
      rotulo: "Remetente",
      ...resumirNomes(lerFiltroTexto(busca.remetente)),
      limpar: () => {
        mudar({ remetente: "" });
      },
    },
    busca.destino.trim() && {
      rotulo: "Destino",
      ...resumirNomes(lerFiltroTexto(busca.destino)),
      limpar: () => {
        mudar({ destino: "" });
      },
    },
    nomesCodigos.length > 0 && {
      rotulo: "Ocorrência",
      ...resumirNomes(nomesCodigos),
      limpar: () => {
        mudar({ codigos: [] });
      },
    },
    nomesTipos.length > 0 && {
      rotulo: "Tipo documento",
      ...resumirNomes(nomesTipos),
      limpar: () => {
        mudar({ tipos: [] });
      },
    },
  ];

  const cliqueNosPrevistos = (c: CliqueNosPrevistos) => {
    abrirLista(c.eixo === "faixa" ? "previstos_por_faixa" : "previstos_por_status", {
      ...(c.eixo === "status" ? { statusPrevisto: c.chave } : {}),
      ...(c.eixo === "faixa" ? { faixaPrev: c.chave } : {}),
      ignorarPeriodo,
      base: "emissao",
    });
  };

  const erro = resumo.error ?? pont.error;
  const cobertura = r?.cobertura;
  const dias = diferencaEmDias(periodo.inicio, periodo.fim) + 1;

  return (
    <Pagina
      titulo={busca.periodo === "hoje" ? "Performance do dia" : `Performance — ${periodo.rotulo}`}
      descricao="Entregas e SLA por unidade no período"
      meta={<SeloDosDados className="" />}
      acoes={
        <>
          <ComoFuncionaPerformance otifVisivel={configuracao.otifVisivel} nomeCurto={nomeCurto} />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void queryClient.invalidateQueries({ queryKey: CHAVE_DA_PERFORMANCE })}
            disabled={resumo.isFetching}
          >
            <RefreshCw className={resumo.isFetching ? "animate-spin" : undefined} aria-hidden />
            Atualizar
          </Button>
          <ExportMenu
            arquivo={`performance-${busca.periodo}`}
            titulo="Performance"
            subtitulo={`${periodo.inicio} → ${periodo.fim}`}
            colunas={COLUNAS_DA_EXPORTACAO}
            linhas={[]}
            carregarLinhas={async () => {
              const r = await chamar(contratosPerformance.exportacao, { entrada });
              if (r.truncado)
                toast.warning("Arquivo limitado aos primeiros 10.000 CT-e. Reduza o período.");
              return r.linhas;
            }}
            desabilitado={resumo.isFetching}
            className="h-8"
          />
          <Button
            size="sm"
            onClick={() => {
              setRelatorioAberto((v) => !v);
            }}
          >
            <FileBarChart aria-hidden />
            {relatorioAberto ? "Fechar relatório" : "Relatório de período"}
          </Button>
        </>
      }
      filtros={
        <>
          <FiltrosAvancados
            ativos={temFiltroLimpavel(busca)}
            aoLimpar={() => void navegarNaTela({ search: limparFiltros(busca) })}
          >
            <FiltroPeriodo
              periodo={busca.periodo}
              de={busca.de}
              ate={busca.ate}
              rotulo={DATA_DA_BASE[busca.base]}
              aoMudar={(m) => {
                mudar({
                  periodo: m.periodo === "mes_anterior" ? "mes" : m.periodo,
                  de: m.de,
                  ate: m.ate,
                });
              }}
            />
            <Alternador<BaseDeData>
              rotulo="Base de data"
              valor={busca.base}
              aoMudar={(b) => {
                mudar({ base: b });
              }}
              opcoes={BASES_DE_DATA.map((b) => ({
                valor: b,
                rotulo: ROTULO_DA_BASE[b],
                dica: DICA_DA_BASE[b],
              }))}
            />
            <span
              className="hidden text-[12.5px] text-muted-foreground sm:inline"
              title={DICA_DA_BASE[busca.base]}
            >
              {BASE_CURTA[busca.base]}
            </span>
            <SeletorDePagador
              rotulo="Parceiros"
              opcoes={pagadores.data}
              selecionados={busca.parceiros}
              aoMudar={(ids) => {
                mudar({ parceiros: ids });
              }}
            />
            <SeletorDeFilial
              selecionadas={busca.filiais}
              contexto={contexto}
              aoMudar={(siglas) => {
                mudar({ filiais: siglas });
              }}
            />
            <SeletorDeTexto
              rotulo="Remetente"
              campo="remetente"
              valor={busca.remetente}
              contexto={contexto}
              aoMudar={(v) => {
                mudar({ remetente: v });
              }}
            />
            <SeletorDeTexto
              rotulo="Destino"
              campo="cidade_destino"
              valor={busca.destino}
              contexto={contexto}
              aoMudar={(v) => {
                mudar({ destino: v });
              }}
            />
            <span
              className="inline-flex items-center"
              title="Filtra os CT-e cuja ocorrência EFETIVA atual (o status vigente do CT-e) é o código selecionado — o mesmo critério da lista detalhada. Não considera ocorrências antigas já superadas na jornada. Todos os cards, gráficos e a lista respeitam esse filtro."
            >
              <FiltroMultiplo
                rotulo="Ocorrência"
                textoVazio="todos"
                opcoes={
                  codigos.data
                    ? ordenarCodigosDisponiveis(codigos.data).map((o) => ({
                        valor: o.codigo,
                        rotulo: `${o.codigo} — ${o.descricao ?? "sem descrição"}`,
                        detalhe: String(o.qtd),
                      }))
                    : undefined
                }
                aoAbrir={setOcorrenciaAberta}
                selecionados={busca.codigos}
                aoMudar={(ids) => {
                  mudar({ codigos: ids });
                }}
              />
            </span>
            <SeletorDeTipoDocumento
              contagens={tiposNoPeriodo.data}
              aoAbrir={setTipoAberto}
              selecionados={busca.tipos}
              aoMudar={(ids) => {
                mudar({ tipos: ids });
              }}
            />
            <BuscaDocumento
              valor=""
              placeholder="CTRC..."
              className="w-[150px]"
              aoMudar={(v) => {
                if (v) abrirLista("emitidos", { ctrc: v, ignorarPeriodo: true });
              }}
            />
            <BuscaDocumento
              valor=""
              placeholder="Nota fiscal..."
              className="w-[150px]"
              aoMudar={(v) => {
                if (v) abrirLista("emitidos", { nf: v, ignorarPeriodo: true });
              }}
            />
          </FiltrosAvancados>
          <FiltrandoPor etiquetas={etiquetas} />
        </>
      }
    >
      {erro && (
        <Aviso tom="erro">
          {mensagemAmigavel(erro, "Não foi possível carregar os dados de performance.")}
        </Aviso>
      )}

      {dias > 183 && (
        <Aviso tom="alerta" titulo={`Período longo selecionado (${String(dias)} dias).`}>
          A consulta pode demorar alguns segundos — considere aplicar filtros de unidade, parceiro
          ou filial para acelerar o carregamento.
        </Aviso>
      )}

      {r &&
        cobertura?.min &&
        cobertura.max &&
        (r.totais.totalCtrcs === 0 || cobertura.min === cobertura.max) && (
          <Aviso tom="info">
            {r.totais.totalCtrcs === 0 ? (
              <>
                Sem CTRCs no intervalo <strong>{periodo.inicio}</strong> →{" "}
                <strong>{periodo.fim}</strong>.{" "}
              </>
            ) : (
              <>
                Os números podem parecer iguais entre períodos porque os CTRCs disponíveis estão
                concentrados em <strong>{cobertura.min}</strong>.{" "}
              </>
            )}
            Mudar o período só altera os valores quando há CTRCs em datas diferentes dentro da
            janela.
          </Aviso>
        )}

      {r && r.totais.ocorrenciasPendentes > 0 && (
        <Aviso
          tom="alerta"
          acao={
            <Button asChild size="sm" variant="outline">
              <a href="/admin/codigos">
                Classificar agora <ArrowRight aria-hidden />
              </a>
            </Button>
          }
        >
          <strong className="font-semibold">{r.totais.ocorrenciasPendentes}</strong> ocorrências
          precisam de classificação para os números ficarem 100% exatos.
        </Aviso>
      )}

      {alertas.data && (
        <BannerDeAlertas
          cartoes={cartoesDeAlerta(alertas.data, pontEmissao.data?.porUnidade ?? [], nomeCurto)}
          onClique={(c) => {
            abrirLista(c.lista, {
              ...(c.unidades ? { unidades: c.unidades } : {}),
              ...(c.lista === "vencimento_proximo" || c.lista === "sem_atualizacao"
                ? { ignorarPeriodo: true }
                : {}),
              ...(c.lista === "nascido_atrasado" ? { abertos: true } : {}),
              base: "emissao",
            });
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

      <DialogoRelatorio
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
