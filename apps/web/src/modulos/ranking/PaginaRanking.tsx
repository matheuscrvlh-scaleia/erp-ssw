import { SEM_TIPO_DOCUMENTO } from "@erp/shared/contratos/filtros";
import { type TipoRecorte } from "@erp/shared/contratos/listagem";
import { type FiltroDoRanking, type LinhaDoRanking } from "@erp/shared/contratos/ranking";
import { hojeNoFuso } from "@erp/shared/datas";
import { formatarCnpj, formatarDiaMes, formatarPercentual } from "@erp/shared/formatacao";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type ReactNode, useMemo, useState } from "react";

import { consultaAcesso } from "@/acesso/sessao";
import { Abas } from "@/componentes/comum/Abas";
import { Alternador } from "@/componentes/comum/Alternador";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { GraficoSerie } from "@/componentes/comum/GraficoSerie";
import { resolverPeriodo, ROTULO_ATALHO } from "@/componentes/comum/periodo";
import { Pagina } from "@/componentes/layout/Pagina";
import { SeloDosDados } from "@/componentes/layout/SeloDosDados";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { nomesDosPagadoresAgrupados } from "@/lib/opcoes-de-filtro";
import { consultaConfiguracoesPublicas } from "@/modulos/admin/api";
import { consultaPagadores, type ContextoDosFiltros } from "@/modulos/filtros/api";
import { caminhoDaLista } from "@/modulos/listagem/busca";

import { consultaRankingOperacional, consultaSerieMensal } from "./api";
import { etiquetasDosFiltros, type FiltrosDoRanking, useFiltrosDoRanking } from "./busca";
import { CardsDoRanking } from "./componentes/CardsDoRanking";
import { FiltrosRanking } from "./componentes/FiltrosRanking";
import { TabelaDoRanking } from "./componentes/TabelaDoRanking";
import { colunasDoRanking, linhasDoRanking } from "./exportacao";
import {
  type ChaveDeOrdem,
  filtrarPorCard,
  type FiltroDoCard,
  kpisDoRanking,
  limiaresDoSla,
  ordenarLinhas,
} from "./regras";
import { escopoDaSerie, ROTULO_DA_BASE } from "./textos";

type Grupo = "pagador" | "cidade";

/** origem: routes/_authenticated/ranking.tsx (sistema atual) */
export function PaginaRanking() {
  const [grupo, setGrupo] = useState<Grupo>("pagador");
  const filtros = useFiltrosDoRanking();
  return (
    // key: cada aba começa com a própria ordenação, filtro dos cards e ano do gráfico.
    <RankingDoGrupo
      key={grupo}
      grupo={grupo}
      filtros={filtros}
      abas={
        <Abas
          rotulo="Abas do ranking"
          abas={[
            { valor: "pagador", rotulo: "Parceiro" },
            { valor: "cidade", rotulo: "Cidade" },
          ]}
          valor={grupo}
          aoMudar={setGrupo}
        />
      }
    />
  );
}

// Preferência do olho do Frete: só conveniência do navegador, vale para as duas abas.
const FRETE_VISIVEL = "ranking:frete-visivel";

function lerFreteVisivel(): boolean {
  try {
    return window.localStorage.getItem(FRETE_VISIVEL) !== "0";
  } catch {
    return true;
  }
}

/**
 * Uma aba do ranking (Parceiro ou Cidade) com a tela inteira: cabeçalho, filtros da página,
 * indicadores, gráfico mês a mês e a tabela. Os filtros vêm de fora e valem para as duas abas.
 */
function RankingDoGrupo({
  grupo,
  filtros: f,
  abas,
}: {
  grupo: Grupo;
  filtros: FiltrosDoRanking;
  abas: ReactNode;
}) {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const fuso = useFusoDaEmpresa();
  const nomeCurto = acesso.empresa?.nomeCurto ?? "transportadora";
  // Q11: "hoje" é o dia da empresa (Brasília), não o do navegador.
  const hoje = hojeNoFuso(fuso);
  const navigate = useNavigate();
  const { data: configuracoes } = useQuery(consultaConfiguracoesPublicas);
  const { meta, alerta } = limiaresDoSla(configuracoes?.valores);
  const { base, filiais, parceiros, destino, remetente, tipos } = f;

  const [ordem, setOrdem] = useState<{ chave: ChaveDeOrdem; direcao: "asc" | "desc" }>({
    chave: "slaPct",
    direcao: "desc",
  });
  const [filtroCard, setFiltroCard] = useState<FiltroDoCard>("todos");
  const [freteVisivel, setFreteVisivel] = useState(lerFreteVisivel);

  const intervalo = resolverPeriodo(f.rapido, f.de, f.ate, hoje, "30d");
  const periodo = {
    ...intervalo,
    rotulo:
      f.rapido === "custom"
        ? `${formatarDiaMes(intervalo.inicio)} → ${formatarDiaMes(intervalo.fim)}`
        : ROTULO_ATALHO[f.rapido],
  };
  const filtro: FiltroDoRanking = {
    grupo,
    inicio: periodo.inicio,
    fim: periodo.fim,
    baseData: base,
    filiais: filiais.length ? filiais : null,
    pagadores: parceiros.length ? parceiros : null,
    destino: destino.trim() || null,
    remetente: remetente.trim() || null,
    tipos: tipos.length ? tipos : null,
  };
  const ranking = useQuery(consultaRankingOperacional(filtro));
  const linhas = useMemo(() => ranking.data ?? [], [ranking.data]);

  // Opções de Parceiros: pagadores com CT-e no período e nas unidades escolhidas.
  const pagadores = useQuery(
    consultaPagadores({ inicio: periodo.inicio, fim: periodo.fim, filiais, campoData: base }),
  );
  const contexto: ContextoDosFiltros = {
    inicio: periodo.inicio,
    fim: periodo.fim,
    filiais,
    parceiros,
    remetente,
    destino,
  };

  const anoAtual = Number(hoje.slice(0, 4));
  const [ano, setAno] = useState(anoAtual);
  // No ano corrente vai só até hoje: os meses seguintes não têm emissão.
  const fimSerie = ano === anoAtual ? hoje : `${String(ano)}-12-31`;
  const serie = useQuery(
    consultaSerieMensal({
      granularidade: "mes",
      inicio: `${ano}-01-01`,
      fim: fimSerie,
      baseData: base,
      filiais: filiais.length ? filiais : undefined,
      parceiros: parceiros.length ? parceiros : undefined,
      destino: destino.trim() || undefined,
      remetente: remetente.trim() || undefined,
      tipos: tipos.length ? tipos : undefined,
    }),
  );

  const alternarFrete = () => {
    const novo = !freteVisivel;
    setFreteVisivel(novo);
    try {
      window.localStorage.setItem(FRETE_VISIVEL, novo ? "1" : "0");
    } catch {
      // Sem storage: vale só nesta visita.
    }
  };

  const kpis = useMemo(() => kpisDoRanking(linhas, meta), [linhas, meta]);
  const rotuloDoGrupo = grupo === "pagador" ? "Parceiro" : "Cidade";
  const plural = grupo === "pagador" ? "parceiros" : "cidades";

  const nomeDe = (r: LinhaDoRanking) =>
    r.rotulo ?? (grupo === "pagador" ? formatarCnpj(r.chave) : r.chave);
  const subDe = (r: LinhaDoRanking) =>
    grupo === "pagador" ? formatarCnpj(r.chave) : (r.sub ?? "");

  const filtradas = useMemo(
    () => filtrarPorCard(linhas, filtroCard, meta),
    [linhas, filtroCard, meta],
  );
  const ordenadas = ordenarLinhas(filtradas, ordem.chave, ordem.direcao, nomeDe);
  const rotuloDoFiltro =
    filtroCard === "na_meta" ? "na meta" : filtroCard === "abaixo_meta" ? "abaixo da meta" : "";
  const alternarCard = (filtroNovo: FiltroDoCard) => {
    setFiltroCard((atual) => (atual === filtroNovo ? "todos" : filtroNovo));
  };

  // Nos dois seletores, CNPJs de mesmo nome (sem acento/caixa) contam como um parceiro, como hoje.
  const nomesParceiros = nomesDosPagadoresAgrupados(pagadores.data ?? [], f.parceirosCnpj);
  const nomesAgrupados = nomesDosPagadoresAgrupados(pagadores.data ?? [], f.parceirosAgrupados);
  const rotulosTipos = tipos.map((t) => (t === SEM_TIPO_DOCUMENTO ? "sem tipo" : t));
  const rotuloTipos = rotulosTipos.join(", ");
  const escopoDoGrafico = escopoDaSerie({
    nomesParceiros: nomesDosPagadoresAgrupados(pagadores.data ?? [], parceiros),
    destino,
    remetente,
    filiais,
    tipos: rotulosTipos,
  });
  const etiquetas = etiquetasDosFiltros(f, {
    parceiros: nomesParceiros,
    agrupados: nomesAgrupados,
    tipos: rotuloTipos,
  });
  const descricaoDosFiltros = etiquetas
    .flatMap((e) => (e ? [`${e.rotulo}: ${e.valor}`] : []))
    .join(" · ");

  // Clique no número abre o recorte daquela coluna; no resto da linha, todos os CT-e dela.
  const abrirCasos = (r: LinhaDoRanking, tipo: TipoRecorte = "emitidos") => {
    void navigate({
      href: caminhoDaLista({
        tipo,
        periodo: "custom",
        de: periodo.inicio,
        ate: periodo.fim,
        base,
        // Leva os filtros da tela: sem eles a lista abria com mais CT-e do que a linha clicada.
        filiais,
        parceiros: grupo === "pagador" ? [r.chave] : parceiros,
        destino: grupo === "cidade" ? nomeDe(r) : destino.trim(),
        remetente: remetente.trim(),
        tipos,
      }),
    });
  };

  const alternarOrdem = (chave: ChaveDeOrdem) => {
    setOrdem((o) =>
      o.chave === chave
        ? { chave, direcao: o.direcao === "asc" ? "desc" : "asc" }
        : { chave, direcao: chave === "nome" ? "asc" : "desc" },
    );
  };

  const carregando = ranking.isFetching && linhas.length === 0;
  const verTodos = () => {
    setFiltroCard("todos");
  };

  return (
    <Pagina
      titulo="Ranking por Parceiro e Cidade"
      descricao="SLA operacional por parceiro (pagador) e por cidade de destino. Clique num item para ver os casos que estão puxando o SLA para baixo."
      meta={
        <>
          <SeloDosDados className="" />
          <span className="tabular-nums">
            meta {formatarPercentual(meta)} · {periodo.rotulo}
          </span>
        </>
      }
      acoes={
        <ExportMenu
          arquivo={`ranking-${grupo === "pagador" ? "parceiro" : "cidade"}`}
          titulo={`Ranking por ${rotuloDoGrupo}`}
          subtitulo={[`${periodo.rotulo} · por ${ROTULO_DA_BASE[base]}`, descricaoDosFiltros]
            .filter(Boolean)
            .join(" · ")}
          colunas={colunasDoRanking(rotuloDoGrupo, freteVisivel)}
          linhas={linhasDoRanking(ordenadas, nomeDe)}
        />
      }
      abas={abas}
      filtros={
        <FiltrosRanking
          filtros={f}
          periodo={periodo}
          pagadores={pagadores.data}
          contexto={contexto}
          etiquetas={etiquetas}
        />
      }
    >
      <CardsDoRanking
        grupo={grupo}
        kpis={kpis}
        meta={meta}
        alerta={alerta}
        plural={plural}
        rotuloDoPeriodo={periodo.rotulo}
        filtroCard={filtroCard}
        aoVerTodos={verTodos}
        aoAlternar={alternarCard}
      />

      <GraficoSerie
        titulo={`SLA mês a mês — ${String(ano)}`}
        subtitulo={`${escopoDoGrafico} · por ${ROTULO_DA_BASE[base]} · não segue o período acima`}
        pontos={serie.data}
        granularidade="mes"
        metricas={["sla_ranking", "volume"]}
        meta={meta}
        carregando={serie.isFetching || (!serie.data && !serie.error)}
        erro={serie.error}
        nomeExport={`ranking-${grupo}-mensal-${String(ano)}`}
        filtrosExtra={
          <Alternador
            rotulo="Ano do gráfico"
            tamanho="pequeno"
            valor={String(ano)}
            aoMudar={(a) => {
              setAno(Number(a));
            }}
            opcoes={[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => ({
              valor: String(a),
              rotulo: String(a),
            }))}
          />
        }
      />

      <TabelaDoRanking
        grupo={grupo}
        rotuloDoGrupo={rotuloDoGrupo}
        plural={plural}
        descricao={`${periodo.rotulo} · por ${ROTULO_DA_BASE[base]}`}
        linhas={linhas}
        filtradas={filtradas}
        ordenadas={ordenadas}
        rotuloDoFiltro={rotuloDoFiltro}
        filtrando={filtroCard !== "todos"}
        aoVerTodos={verTodos}
        carregando={carregando}
        erro={ranking.error}
        aoTentarDeNovo={() => void ranking.refetch()}
        meta={meta}
        alerta={alerta}
        nomeCurto={nomeCurto}
        nomeDe={nomeDe}
        subDe={subDe}
        ordem={ordem}
        aoOrdenar={alternarOrdem}
        freteVisivel={freteVisivel}
        aoAlternarFrete={alternarFrete}
        aoAbrir={abrirCasos}
      />
    </Pagina>
  );
}
