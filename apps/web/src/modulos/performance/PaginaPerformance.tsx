import { montarBloco } from "@erp/dominio/performance/relatorio";
import { janelaDaSerie } from "@erp/dominio/performance/serie";
import {
  ordenarCodigosDisponiveis,
  ordenarTiposDocumento,
  ordenarUnidades,
  resolverPeriodo,
} from "@erp/dominio/performance/tela";
import { type BaseDeData, BASES_DE_DATA } from "@erp/shared/contratos/performance";
import { diferencaEmDias, hojeNoFuso } from "@erp/shared/datas";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, FileBarChart, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { consultaAcesso } from "@/acesso/sessao";
import { Button } from "@/componentes/ui/button";

import { cartoesDeAlerta } from "./alertas";
import {
  CHAVE_DA_PERFORMANCE,
  consultaAlertas,
  consultaCodigosDisponiveis,
  consultaConfiguracao,
  consultaOtif,
  consultaPagadores,
  consultaPontualidade,
  consultaPrevistos,
  consultaResumo,
  consultaSerie,
  consultaSugestoes,
  consultaTde,
  consultaTiposDocumento,
  consultaTiposNoPeriodo,
  consultaUnidadesResponsaveis,
  entradaDoFiltro,
} from "./api";
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
import { BannerDeAlertas } from "./componentes/Alertas";
import { ExportarTela } from "./componentes/ExportarTela";
import {
  BuscaDocumento,
  type Etiqueta,
  FiltrandoPor,
  FiltroDatas,
  FiltroTexto,
  resumirNomes,
  SeletorMultiplo,
} from "./componentes/Filtros";
import { GraficoSerie } from "./componentes/GraficoSerie";
import { EsqueletoDeCards, LinhaDeKpis } from "./componentes/Kpis";
import { type CliqueNosPrevistos, SecaoPrevistos } from "./componentes/Previstos";
import {
  type CardDeProducao,
  LinhaDeProducao,
  VerificacaoDaParticao,
} from "./componentes/Producao";
import { DialogoRelatorio } from "./componentes/RelatorioPeriodo";
import { TabelaDeUnidades } from "./componentes/TabelaUnidades";
import { textoDoStatus } from "./formato";

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
    return () => { observador.disconnect(); };
  }, [visivel]);
  return [ref, visivel];
}

export function PaginaPerformance() {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const nomeCurto = acesso.empresa?.nomeCurto ?? "";
  const fuso = acesso.empresa?.fuso ?? "America/Sao_Paulo";
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
    ...consultaPagadores({ ...periodo, unidades: filtros.unidades, filiais: filtros.filiais }),
    enabled: !!r,
  });

  const [ocorrenciaAberta, setOcorrenciaAberta] = useState(false);
  const [tipoAberto, setTipoAberto] = useState(false);
  const [filialAberta, setFilialAberta] = useState(false);
  const codigos = useQuery({
    ...consultaCodigosDisponiveis(entrada),
    enabled: ocorrenciaAberta || busca.codigos.length > 0,
  });
  const tiposOpcoes = useQuery({ ...consultaTiposDocumento, enabled: tipoAberto });
  const tiposNoPeriodo = useQuery({ ...consultaTiposNoPeriodo(entrada), enabled: tipoAberto });
  const filiais = useQuery({
    ...consultaUnidadesResponsaveis({
      ...periodo,
      parceiros: filtros.parceiros,
      remetente: filtros.remetente,
      destino: filtros.destino,
      codigos: filtros.codigos,
    }),
    enabled: filialAberta,
  });
  const [buscaTexto, setBuscaTexto] = useState<{
    campo: "remetente" | "cidade_destino";
    q: string;
  }>({
    campo: "remetente",
    q: "",
  });
  const sugestoes = useQuery({
    ...consultaSugestoes({
      ...buscaTexto,
      ...periodo,
      parceiros: filtros.parceiros,
      remetente: filtros.remetente,
      destino: filtros.destino,
      filiais: filtros.filiais,
      codigos: filtros.codigos,
    }),
    enabled: !!r,
  });

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
    (cnpj) => pagadores.data?.find((p) => p.cnpj === cnpj)?.nome ?? cnpj,
  );
  const nomesCodigos = busca.codigos.map((cod) => {
    const descricao = codigos.data?.find((o) => o.codigo === cod)?.descricao;
    return descricao ? `${cod} — ${descricao}` : cod;
  });
  const nomesTipos = busca.tipos.map((t) => (t === "__SEM_TIPO__" ? "sem tipo" : t));
  const textoDoFiltro = (v: string) =>
    v
      .split("|")
      .map((p) => p.trim())
      .filter(Boolean);
  const se = (ligado: unknown, e: Etiqueta): Etiqueta[] => (ligado ? [e] : []);
  const etiquetas: Etiqueta[] = [
    ...se(nomesUnidades.length > 0, {
      rotulo: "Unidade",
      valor: resumirNomes(nomesUnidades),
      limpar: () => { mudar({ unidades: [] }); },
    }),
    ...se(nomesParceiros.length > 0, {
      rotulo: "Parceiros",
      valor: resumirNomes(nomesParceiros),
      limpar: () => { mudar({ parceiros: [] }); },
    }),
    ...se(busca.filiais.length > 0, {
      rotulo: "Unidade responsável",
      valor: resumirNomes(busca.filiais),
      limpar: () => { mudar({ filiais: [] }); },
    }),
    ...se(busca.remetente.trim(), {
      rotulo: "Remetente",
      valor: resumirNomes(textoDoFiltro(busca.remetente)),
      limpar: () => { mudar({ remetente: "" }); },
    }),
    ...se(busca.destino.trim(), {
      rotulo: "Destino",
      valor: resumirNomes(textoDoFiltro(busca.destino)),
      limpar: () => { mudar({ destino: "" }); },
    }),
    ...se(nomesCodigos.length > 0, {
      rotulo: "Ocorrência",
      valor: resumirNomes(nomesCodigos),
      limpar: () => { mudar({ codigos: [] }); },
    }),
    ...se(nomesTipos.length > 0, {
      rotulo: "Tipo documento",
      valor: resumirNomes(nomesTipos),
      limpar: () => { mudar({ tipos: [] }); },
    }),
  ];

  const cliqueNosPrevistos = (c: CliqueNosPrevistos) => { abrirLista(c.eixo === "faixa" ? "previstos_por_faixa" : "previstos_por_status", {
      ...(c.eixo === "status" ? { statusPrevisto: c.chave } : {}),
      ...(c.eixo === "faixa" ? { faixaPrev: c.chave } : {}),
      ignorarPeriodo,
      base: "emissao",
    }); };

  const erro = resumo.error ?? pont.error;
  const cobertura = r?.cobertura;
  const dias = diferencaEmDias(periodo.inicio, periodo.fim) + 1;
  const alternador = (ativo: boolean, cor: string) =>
    "rounded-[5px] px-3 py-1 text-[12px] transition-colors " +
    (ativo ? cor : "text-muted-foreground hover:bg-muted");

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <h1 className="truncate text-[24px] font-semibold">
            {busca.periodo === "hoje" ? "Performance do dia" : `Performance — ${periodo.rotulo}`}
          </h1>
          {/* TODO(kit-ui): SeloAtualizacao do kit (última sincronização dos dados). */}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => { setRelatorioAberto((v) => !v); }}>
            <FileBarChart className="mr-1.5 h-3 w-3" />
            {relatorioAberto ? "Fechar relatório" : "Relatório de período"}
          </Button>
          <ExportarTela
            entrada={entrada}
            periodo={busca.periodo}
            empresa={nomeCurto}
            desabilitado={resumo.isFetching}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void queryClient.invalidateQueries({ queryKey: CHAVE_DA_PERFORMANCE })}
            disabled={resumo.isFetching}
          >
            <RefreshCw className={`mr-1.5 h-3 w-3 ${resumo.isFetching ? "animate-spin" : ""}`} />{" "}
            Atualizar
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-border/70 bg-card p-2">
        <div className="flex rounded-md border border-border/70 p-0.5">
          {(["hoje", "7d", "30d", "mes"] as const).map((p) => (
            <button
              key={p}
              onClick={() => { mudar({ periodo: p, de: "", ate: "" }); }}
              className={alternador(busca.periodo === p, "bg-[var(--brand)] text-white")}
            >
              {p === "hoje" ? "Hoje" : p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "Mês"}
            </button>
          ))}
        </div>
        <div
          className="flex rounded-md border border-border/70 p-0.5"
          title={DICA_DA_BASE[busca.base]}
        >
          {BASES_DE_DATA.map((b: BaseDeData) => (
            <button
              key={b}
              onClick={() => { mudar({ base: b }); }}
              title={DICA_DA_BASE[b]}
              className={alternador(busca.base === b, "bg-foreground text-background")}
            >
              {ROTULO_DA_BASE[b]}
            </button>
          ))}
        </div>
        <FiltroDatas
          rotulo={DATA_DA_BASE[busca.base]}
          de={busca.de}
          ate={busca.ate}
          onChange={(de, ate) => { mudar({ de, ate, periodo: de && ate ? "custom" : "mes" }); }}
        />
        <span className="text-[11px] text-muted-foreground" title={DICA_DA_BASE[busca.base]}>
          {BASE_CURTA[busca.base]}
        </span>
        <BuscaDocumento
          placeholder="CTRC..."
          onBuscar={(v) => { abrirLista("emitidos", { ctrc: v, ignorarPeriodo: true }); }}
        />
        <BuscaDocumento
          placeholder="Nota fiscal..."
          onBuscar={(v) => { abrirLista("emitidos", { nf: v, ignorarPeriodo: true }); }}
        />
        <SeletorMultiplo
          rotulo="Parceiros"
          opcoes={(pagadores.data ?? []).map((p) => ({
            id: p.cnpj,
            rotulo: p.nome,
            sub: p.cnpjFormatado,
          }))}
          carregando={pagadores.isFetching}
          selecionados={busca.parceiros}
          onChange={(ids) => { mudar({ parceiros: ids }); }}
        />
        <SeletorMultiplo
          rotulo="Unidade responsável"
          opcoes={[...new Set([...(filiais.data?.siglas ?? []), ...busca.filiais])].map((s) => ({
            id: s,
            rotulo: s,
          }))}
          carregando={filiais.isFetching}
          onAbrir={setFilialAberta}
          selecionados={busca.filiais}
          onChange={(ids) => { mudar({ filiais: ids }); }}
        />
        <FiltroTexto
          rotulo="Remetente"
          valor={busca.remetente}
          onChange={(v) => { mudar({ remetente: v }); }}
          sugestoes={buscaTexto.campo === "remetente" ? (sugestoes.data ?? []) : []}
          onBusca={(q) => { setBuscaTexto({ campo: "remetente", q }); }}
        />
        <FiltroTexto
          rotulo="Destino"
          valor={busca.destino}
          onChange={(v) => { mudar({ destino: v }); }}
          sugestoes={buscaTexto.campo === "cidade_destino" ? (sugestoes.data ?? []) : []}
          onBusca={(q) => { setBuscaTexto({ campo: "cidade_destino", q }); }}
        />
        <SeletorMultiplo
          rotulo="Ocorrência"
          dica="Filtra os CT-e cuja ocorrência EFETIVA atual (o status vigente do CT-e) é o código selecionado — o mesmo critério da lista detalhada. Não considera ocorrências antigas já superadas na jornada. Todos os cards, gráficos e a lista respeitam esse filtro."
          opcoes={ordenarCodigosDisponiveis(codigos.data ?? []).map((o) => ({
            id: o.codigo,
            rotulo: `${o.codigo} — ${o.descricao ?? "sem descrição"}`,
            sub: String(o.qtd),
          }))}
          carregando={codigos.isFetching}
          onAbrir={setOcorrenciaAberta}
          selecionados={busca.codigos}
          onChange={(ids) => { mudar({ codigos: ids }); }}
        />
        <SeletorMultiplo
          rotulo="Tipo documento"
          opcoes={ordenarTiposDocumento(tiposOpcoes.data ?? [], tiposNoPeriodo.data).map((t) => ({
            id: t.tipo,
            rotulo: t.rotulo,
            sub: String(t.qtd),
          }))}
          carregando={tiposOpcoes.isFetching}
          onAbrir={setTipoAberto}
          selecionados={busca.tipos}
          onChange={(ids) => { mudar({ tipos: ids }); }}
        />
        {temFiltroLimpavel(busca) && (
          <button
            className="text-[12px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => void navegarNaTela({ search: limparFiltros(busca) })}
          >
            Limpar filtros
          </button>
        )}
      </div>

      <FiltrandoPor etiquetas={etiquetas} />

      {dias > 183 && (
        <div className="flex items-start gap-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <strong>Período longo selecionado ({dias} dias).</strong> A consulta pode demorar alguns
            segundos — considere aplicar filtros de unidade, parceiro ou filial para acelerar o
            carregamento.
          </div>
        </div>
      )}

      {alertas.data && (
        <BannerDeAlertas
          cartoes={cartoesDeAlerta(alertas.data, pontEmissao.data?.porUnidade ?? [], nomeCurto)}
          onClique={(c) => { abrirLista(c.lista, {
              ...(c.unidades ? { unidades: c.unidades } : {}),
              ...(c.lista === "vencimento_proximo" || c.lista === "sem_atualizacao"
                ? { ignorarPeriodo: true }
                : {}),
              ...(c.lista === "nascido_atrasado" ? { abertos: true } : {}),
              base: "emissao",
            }); }
          }
        />
      )}

      {erro && (
        <div
          className="flex items-start gap-2 rounded-[10px] border border-amber-200 bg-[var(--status-warn-bg)] px-4 py-3 text-[12px]"
          style={{ color: textoDoStatus.warn }}
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{erro.message || "Não foi possível carregar os dados de performance."}</span>
        </div>
      )}

      {r &&
        cobertura?.min &&
        cobertura.max &&
        (r.totais.totalCtrcs === 0 || cobertura.min === cobertura.max) && (
          <div className="flex items-start gap-2 rounded-[10px] border border-border/70 bg-muted/40 px-4 py-2.5 text-[12px] text-muted-foreground">
            <AlertTriangle
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              style={{ color: textoDoStatus.warn }}
            />
            <span>
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
            </span>
          </div>
        )}

      {r ? (
        <LinhaDeKpis
          resumo={r}
          pontualidade={pont.data}
          otif={otif.data}
          configuracao={configuracao}
          nomeCurto={nomeCurto}
          acoes={{
            emAtraso: () => { abrirLista("em_atraso"); },
            emAtrasoFr: () => { abrirLista("em_atraso_fr"); },
            emAtrasoCliente: () => { abrirLista("em_atraso_cliente"); },
            nascidos: () => { abrirLista("nascido_em_atraso"); },
            otif: () => { abrirLista("otif"); },
          }}
        />
      ) : (
        <EsqueletoDeCards quantos={5} altura="h-[140px]" />
      )}
      <p className="-mt-3 text-[11px] text-muted-foreground">
        {configuracao.otifVisivel && (
          <>
            <strong className="font-medium text-foreground">OTIF:</strong> percentual dos CTRCs do
            período que tiveram algum problema no percurso (pendência do cliente ou da operação),
            mesmo que tenham sido entregues no fim. Quanto menor, melhor — mesma leitura usada na
            tela de Romaneio, que mede só as cargas que já saíram para entrega.
            {"  ·  "}
          </>
        )}
        <strong className="font-medium text-foreground">Nascidos em atraso:</strong> CTRCs emitidos
        a menos de 48 horas (corridas) da previsão de entrega — o atraso é do parceiro, não da{" "}
        {nomeCurto}.{"  ·  "}
        <strong className="font-medium text-foreground">SLA Operacional:</strong> (CT-e emitidos −
        entregues fora do prazo) ÷ CT-e emitidos.
      </p>

      {bloco ? (
        <LinhaDeProducao
          bloco={bloco}
          tde={tde.data}
          slaMetaPct={configuracao.slaMetaPct}
          onCard={(card) => { abrirLista(CARD_PARA_LISTA[card]); }}
        />
      ) : (
        <EsqueletoDeCards quantos={7} altura="h-[124px]" />
      )}

      <SecaoPrevistos
        dados={previstos.data}
        carregando={previstos.isFetching}
        ignorarPeriodo={ignorarPeriodo}
        onIgnorarPeriodo={setIgnorarPeriodo}
        onClique={cliqueNosPrevistos}
      />

      {bloco && <VerificacaoDaParticao bloco={bloco} ignorarPeriodo={ignorarPeriodo} />}

      <TabelaDeUnidades
        linhas={linhas}
        ordem={busca.ordem}
        carregando={resumo.isFetching}
        periodo={periodo}
        empresa={nomeCurto}
        meta={configuracao.slaMetaPct / 100}
        alerta={configuracao.slaAlertaAmareloPct / 100}
        onInverterOrdem={() => { mudar({ ordem: busca.ordem === "pior" ? "melhor" : "pior" }); }}
        onUnidade={(sigla) => { abrirLista("emitidos", { unidades: [sigla] }); }}
        onPenalizados={(sigla) => { abrirLista("penalizados_abertos", { unidades: [sigla] }); }}
      />

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
          meta={configuracao.slaMetaPct / 100}
          carregando={serie.isFetching || (!serie.data && !serie.error)}
          erro={serie.error}
        />
      </div>

      <DialogoRelatorio
        aberto={relatorioAberto}
        onAberto={setRelatorioAberto}
        fuso={fuso}
        empresa={nomeCurto}
        herdados={{
          entrada: filtros,
          codigos: busca.codigos,
          etiquetas: etiquetas.map((e) => ({ rotulo: e.rotulo, valor: e.valor })),
        }}
      />

      {r && r.totais.ocorrenciasPendentes > 0 && (
        <a
          href="/admin/codigos"
          className="flex items-center justify-between gap-3 rounded-[10px] border border-amber-200 bg-[var(--status-warn-bg)] px-4 py-3 text-[12px] transition-colors hover:bg-amber-100"
        >
          <span className="flex items-center gap-2" style={{ color: textoDoStatus.warn }}>
            <AlertTriangle className="h-4 w-4" />
            <strong className="font-medium">{r.totais.ocorrenciasPendentes}</strong> ocorrências
            precisam de classificação para os números ficarem 100% exatos.
          </span>
          <span
            className="flex items-center gap-1 font-medium"
            style={{ color: textoDoStatus.warn }}
          >
            Classificar agora <ArrowRight className="h-3 w-3" />
          </span>
        </a>
      )}
    </div>
  );
}
