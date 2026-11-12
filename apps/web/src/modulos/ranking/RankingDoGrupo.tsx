import { SEM_TIPO_DOCUMENTO } from "@erp/shared/contratos/filtros";
import { type TipoRecorte } from "@erp/shared/contratos/listagem";
import { type FiltroDoRanking, type LinhaDoRanking } from "@erp/shared/contratos/ranking";
import { hojeNoFuso } from "@erp/shared/datas";
import { lerFiltroTexto } from "@erp/shared/filtro-texto";
import {
  formatarCnpj,
  formatarDecimal,
  formatarDiaMes,
  formatarInteiro,
  formatarMoeda,
  formatarPercentual,
} from "@erp/shared/formatacao";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Gauge,
  Handshake,
  MapPin,
  SearchX,
  TrendingDown,
} from "lucide-react";
import { type KeyboardEvent, type ReactNode, useMemo, useState } from "react";

import { consultaAcesso } from "@/acesso/sessao";
import { Alternador } from "@/componentes/comum/Alternador";
import {
  CLASSE_CABECALHO,
  CLASSE_LINHA,
  CLASSE_TABELA,
  CLASSE_TH,
} from "@/componentes/comum/classes-de-tabela";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { FiltroPeriodo } from "@/componentes/comum/FiltroPeriodo";
import {
  type EtiquetaFiltroOpcional,
  FiltrandoPor,
  FiltrosAvancados,
  resumirNomes,
} from "@/componentes/comum/FiltrosAvancados";
import { GraficoSerie } from "@/componentes/comum/GraficoSerie";
import { KpiCard } from "@/componentes/comum/KpiCard";
import { LinhasCarregando } from "@/componentes/comum/LinhasCarregando";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { resolverPeriodo, ROTULO_ATALHO } from "@/componentes/comum/periodo";
import { Pagina } from "@/componentes/layout/Pagina";
import { SeloDosDados } from "@/componentes/layout/SeloDosDados";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { type ColunaExportacao } from "@/lib/exportacao";
import { cn } from "@/lib/utils";
import { consultaConfiguracoesPublicas } from "@/modulos/admin/api";
import { consultaPagadores } from "@/modulos/filtros/api";
import {
  type ContextoDosFiltros,
  SeletorDeFilial,
  SeletorDePagador,
  SeletorDePagadorAgrupado,
  SeletorDeTexto,
  SeletorDeTipoDocumento,
} from "@/modulos/filtros/componentes";
import { nomesDosPagadoresAgrupados } from "@/modulos/filtros/regras";
import { caminhoDaLista } from "@/modulos/listagem/busca";

import { consultaRankingOperacional, consultaSerieMensal } from "./api";
import { type Base, type FiltrosDoRanking } from "./filtros-do-ranking";
import {
  type ChaveDeOrdem,
  COR_DO_NIVEL,
  escopoDaSerie,
  filtrarPorCard,
  type FiltroDoCard,
  kpisDoRanking,
  limiaresDoSla,
  nivelDoSla,
  ordenarLinhas,
} from "./ranking-tela";

const ROTULO_DA_BASE: Record<Base, string> = {
  emissao: "data de emissão",
  prevista: "data prevista de entrega",
};

// Preferência do olho do Frete: só conveniência do navegador, vale para as duas abas.
const FRETE_VISIVEL = "ranking:frete-visivel";

function lerFreteVisivel(): boolean {
  try {
    return window.localStorage.getItem(FRETE_VISIVEL) !== "0";
  } catch {
    return true;
  }
}

const ATALHOS = ["hoje", "7d", "30d", "mes"] as const;
// Tabela larga (15 colunas): células um pouco mais justas que as do TabelaDados.
const TD = "px-2.5 py-2.5";

/**
 * Uma aba do ranking (Parceiro ou Cidade) com a tela inteira: cabeçalho, filtros da página,
 * indicadores, gráfico mês a mês e a tabela. Os filtros vêm de fora e valem para as duas abas.
 */
export function RankingDoGrupo({
  grupo,
  filtros: f,
  abas,
}: {
  grupo: "pagador" | "cidade";
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
  const statusDoSlaMedio = nivelDoSla(kpis.slaMedio, meta, alerta);
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
  const etiquetas: EtiquetaFiltroOpcional[] = [
    nomesParceiros.length > 0 && {
      rotulo: nomesParceiros.length === 1 ? "Parceiro" : "Parceiros",
      ...resumirNomes(nomesParceiros),
      limpar: () => {
        f.setParceirosCnpj([]);
      },
    },
    nomesAgrupados.length > 0 && {
      rotulo: nomesAgrupados.length === 1 ? "Parceiro agrupado" : "Parceiros agrupados",
      ...resumirNomes(nomesAgrupados),
      limpar: () => {
        f.setParceirosAgrupados([]);
      },
    },
    remetente.trim() !== "" && {
      rotulo: "Remetente",
      ...resumirNomes(lerFiltroTexto(remetente)),
      limpar: () => {
        f.setRemetente("");
      },
    },
    destino.trim() !== "" && {
      rotulo: "Destino",
      ...resumirNomes(lerFiltroTexto(destino)),
      limpar: () => {
        f.setDestino("");
      },
    },
    filiais.length > 0 && {
      rotulo: "Unidade responsável",
      valor: filiais.join(", "),
      limpar: () => {
        f.setFiliais([]);
      },
    },
    tipos.length > 0 && {
      rotulo: "Tipo",
      valor: rotuloTipos,
      limpar: () => {
        f.setTipos([]);
      },
    },
  ];
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
  const teclaNaLinha = (e: KeyboardEvent<HTMLTableRowElement>, r: LinhaDoRanking) => {
    if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    abrirCasos(r);
  };

  const celula = (r: LinhaDoRanking, valor: number, tipo: TipoRecorte, dica: string) => (
    <td className={cn(TD, "text-right")}>
      <button
        type="button"
        title={`Ver: ${dica}`}
        onClick={(e) => {
          e.stopPropagation();
          abrirCasos(r, tipo);
        }}
        className="-mx-1 rounded-md px-1 py-0.5 underline-offset-2 hover:bg-brand-suave hover:text-brand hover:underline"
      >
        {formatarInteiro(valor)}
      </button>
    </td>
  );

  const colunasExportacao: ColunaExportacao[] = [
    { chave: "nome", titulo: rotuloDoGrupo },
    { chave: "totalCtes", titulo: "CT-e", formato: "inteiro" },
    { chave: "entregue", titulo: "Entregue", formato: "inteiro" },
    { chave: "noPrazo", titulo: "No Prazo", formato: "inteiro" },
    { chave: "foraPrazo", titulo: "Fora Prazo", formato: "inteiro" },
    { chave: "foraCliente", titulo: "Cliente", formato: "inteiro" },
    { chave: "foraTransp", titulo: "Transp.", formato: "inteiro" },
    { chave: "slaPct", titulo: "SLA", formato: "percentual" },
    { chave: "aEntregar", titulo: "A Entregar", formato: "inteiro" },
    { chave: "atrasadas", titulo: "Atrasadas", formato: "inteiro" },
    { chave: "noPrazoAberto", titulo: "No Prazo (aberto)", formato: "inteiro" },
    { chave: "peso", titulo: "Peso (kg)", formato: "inteiro" },
    { chave: "volumes", titulo: "Volumes", formato: "inteiro" },
    ...(freteVisivel ? [{ chave: "frete", titulo: "Frete (R$)", formato: "moeda" as const }] : []),
  ];
  const linhasExportacao = ordenadas.map((r) => ({ ...r, nome: nomeDe(r) }));

  const cabecalhos: { chave: ChaveDeOrdem; rotulo: string; alinhar: "left" | "right" }[] = [
    { chave: "nome", rotulo: rotuloDoGrupo, alinhar: "left" },
    { chave: "totalCtes", rotulo: "CT-e", alinhar: "right" },
    { chave: "entregue", rotulo: "Entregue", alinhar: "right" },
    { chave: "noPrazo", rotulo: "No Prazo", alinhar: "right" },
    { chave: "foraPrazo", rotulo: "Fora", alinhar: "right" },
    { chave: "foraCliente", rotulo: "Cliente", alinhar: "right" },
    { chave: "foraTransp", rotulo: "Transp.", alinhar: "right" },
    { chave: "slaPct", rotulo: "SLA", alinhar: "right" },
    { chave: "aEntregar", rotulo: "A Entregar", alinhar: "right" },
    { chave: "atrasadas", rotulo: "Atrasadas", alinhar: "right" },
    { chave: "peso", rotulo: "Peso", alinhar: "right" },
    { chave: "volumes", rotulo: "Volumes", alinhar: "right" },
    { chave: "frete", rotulo: "Frete", alinhar: "right" },
  ];

  const alternarOrdem = (chave: ChaveDeOrdem) => {
    setOrdem((o) =>
      o.chave === chave
        ? { chave, direcao: o.direcao === "asc" ? "desc" : "asc" }
        : { chave, direcao: chave === "nome" ? "asc" : "desc" },
    );
  };

  const carregando = ranking.isFetching && linhas.length === 0;
  const textoDoOlho = freteVisivel ? "Ocultar valores de frete" : "Mostrar valores de frete";

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
          colunas={colunasExportacao}
          linhas={linhasExportacao}
        />
      }
      abas={abas}
      filtros={
        <>
          <FiltrosAvancados ativos={f.ativos} aoLimpar={f.limpar}>
            <FiltroPeriodo
              periodo={f.rapido}
              de={f.de}
              ate={f.ate}
              atalhos={ATALHOS}
              padrao="30d"
              rotulo={base === "emissao" ? "Emissão" : "Previsão"}
              aoMudar={f.mudarPeriodo}
            />
            <Alternador
              rotulo="Data usada no período"
              valor={base}
              aoMudar={f.setBase}
              opcoes={[
                {
                  valor: "emissao",
                  rotulo: "Emissão",
                  dica: `Recorta o período pela ${ROTULO_DA_BASE.emissao} do CT-e`,
                },
                {
                  valor: "prevista",
                  rotulo: "Previsão de entrega",
                  dica: `Recorta o período pela ${ROTULO_DA_BASE.prevista} do CT-e`,
                },
              ]}
            />
            <SeletorDeFilial selecionadas={filiais} contexto={contexto} aoMudar={f.setFiliais} />
            <SeletorDePagador
              rotulo="Parceiros"
              opcoes={pagadores.data}
              selecionados={f.parceirosCnpj}
              aoMudar={f.setParceirosCnpj}
            />
            <SeletorDePagadorAgrupado
              rotulo="Parceiros agrupados"
              opcoes={pagadores.data}
              selecionados={f.parceirosAgrupados}
              aoMudar={f.setParceirosAgrupados}
            />
            <SeletorDeTexto
              rotulo="Remetente"
              campo="remetente"
              valor={remetente}
              contexto={contexto}
              aoMudar={f.setRemetente}
            />
            <SeletorDeTexto
              rotulo="Destino"
              campo="cidade_destino"
              valor={destino}
              contexto={contexto}
              aoMudar={f.setDestino}
            />
            <SeletorDeTipoDocumento
              selecionados={tipos}
              escopo={{ inicio: periodo.inicio, fim: periodo.fim, campoData: base }}
              aoMudar={f.setTipos}
            />
          </FiltrosAvancados>
          <FiltrandoPor etiquetas={etiquetas} />
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          rotulo={grupo === "pagador" ? "Parceiros" : "Cidades"}
          valor={formatarInteiro(kpis.grupos)}
          status="bom"
          neutro
          icone={grupo === "pagador" ? Handshake : MapPin}
          detalhe="no período · ver todos"
          aoClicar={() => {
            setFiltroCard("todos");
          }}
          ativo={filtroCard === "todos"}
        />
        <KpiCard
          rotulo="CT-e no período"
          valor={formatarInteiro(kpis.totalCtes)}
          status="bom"
          neutro
          icone={FileText}
          detalhe={periodo.rotulo}
          aoClicar={() => {
            setFiltroCard("todos");
          }}
          ativo={filtroCard === "todos"}
        />
        <KpiCard
          rotulo="SLA médio"
          valor={formatarPercentual(kpis.slaMedio)}
          status={statusDoSlaMedio ?? "bom"}
          neutro={statusDoSlaMedio === null}
          progresso={kpis.slaMedio ?? undefined}
          icone={Gauge}
          detalhe={`meta ${formatarPercentual(meta)} · ver os que atingem`}
          aoClicar={() => {
            alternarCard("na_meta");
          }}
          ativo={filtroCard === "na_meta"}
        />
        <KpiCard
          rotulo="Abaixo da meta"
          valor={formatarInteiro(kpis.abaixoMeta)}
          status={kpis.abaixoMeta > 0 ? "ruim" : "bom"}
          icone={TrendingDown}
          detalhe={`de ${formatarInteiro(kpis.grupos)} ${plural}`}
          aoClicar={() => {
            alternarCard("abaixo_meta");
          }}
          ativo={filtroCard === "abaixo_meta"}
        />
      </div>

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

      <Painel
        titulo={`Ranking por ${rotuloDoGrupo}`}
        descricao={`${periodo.rotulo} · por ${ROTULO_DA_BASE[base]}`}
        barra={
          filtroCard !== "todos" && (
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              <span>
                Mostrando {formatarInteiro(filtradas.length)} de {formatarInteiro(linhas.length)}{" "}
                {plural} {rotuloDoFiltro}.
              </span>
              <button
                type="button"
                onClick={() => {
                  setFiltroCard("todos");
                }}
                className="font-semibold text-brand underline-offset-2 hover:underline"
              >
                Ver todos
              </button>
            </div>
          )
        }
        rodape={
          <p className="text-xs">
            SLA = (entregue − atrasos por culpa da transportadora) ÷ entregue — atraso de
            responsabilidade do cliente não penaliza. Clique num número para ver os CT-e daquela
            coluna, ou no resto da linha para ver todos os CT-e do parceiro ou da cidade.
            {grupo === "cidade"
              ? " A cidade considera tudo emitido para ela, independente de parceiro."
              : ""}
          </p>
        }
      >
        <div className="rolagem-fina relative overflow-x-auto">
          <table className={CLASSE_TABELA} aria-busy={carregando}>
            <thead>
              <tr className={CLASSE_CABECALHO}>
                <th scope="col" className={cn(CLASSE_TH, "px-2.5")}>
                  #
                </th>
                {cabecalhos.map((h) => {
                  const ativo = ordem.chave === h.chave;
                  const IconeOrdem = !ativo
                    ? ArrowUpDown
                    : ordem.direcao === "asc"
                      ? ArrowUp
                      : ArrowDown;
                  return (
                    <th
                      key={h.chave}
                      scope="col"
                      aria-sort={
                        ativo ? (ordem.direcao === "asc" ? "ascending" : "descending") : undefined
                      }
                      className={cn(
                        CLASSE_TH,
                        "px-2.5",
                        h.alinhar === "right" ? "text-right" : "text-left",
                        ativo && "text-foreground",
                      )}
                    >
                      <span className="inline-flex items-center gap-1">
                        {h.chave === "frete" && (
                          <button
                            type="button"
                            onClick={alternarFrete}
                            title={textoDoOlho}
                            aria-label={textoDoOlho}
                            className="rounded-md p-0.5 hover:bg-muted hover:text-foreground"
                          >
                            {freteVisivel ? (
                              <Eye className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                              <EyeOff className="h-3.5 w-3.5" aria-hidden />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            alternarOrdem(h.chave);
                          }}
                          title="Ordenar por esta coluna"
                          className="inline-flex items-center gap-0.5 uppercase hover:text-foreground"
                        >
                          {h.rotulo}
                          <IconeOrdem
                            className={cn("h-3 w-3", !ativo && "opacity-50")}
                            aria-hidden
                          />
                        </button>
                      </span>
                    </th>
                  );
                })}
                <th scope="col" className="w-8">
                  <span className="sr-only">Abrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {carregando && <LinhasCarregando linhas={8} colunas={15} />}
              {!carregando && ranking.error && (
                <tr>
                  <td colSpan={15}>
                    <MensagemErro
                      erro={ranking.error}
                      aoTentarDeNovo={() => void ranking.refetch()}
                    />
                  </td>
                </tr>
              )}
              {!carregando && !ranking.error && linhas.length === 0 && (
                <tr>
                  <td colSpan={15}>
                    <EstadoVazio
                      icone={SearchX}
                      mensagem={`Nenhum ${rotuloDoGrupo.toLowerCase()} no período.`}
                      detalhe="Amplie o período ou tire filtros."
                    />
                  </td>
                </tr>
              )}
              {linhas.length > 0 && filtradas.length === 0 && (
                <tr>
                  <td colSpan={15}>
                    <EstadoVazio
                      mensagem={`Nenhum ${rotuloDoGrupo.toLowerCase()} ${rotuloDoFiltro} no período.`}
                    />
                  </td>
                </tr>
              )}
              {ordenadas.map((r, i) => {
                const nivel = nivelDoSla(r.slaPct, meta, alerta);
                return (
                  <tr
                    key={r.chave}
                    tabIndex={0}
                    onClick={() => {
                      abrirCasos(r);
                    }}
                    onKeyDown={(e) => {
                      teclaNaLinha(e, r);
                    }}
                    title="Ver todos os CT-e (clique num número para ver só aquela coluna)"
                    className={cn(
                      CLASSE_LINHA,
                      "cursor-pointer focus-visible:bg-accent focus-visible:outline-none",
                    )}
                    style={nivel === "ruim" ? { background: COR_DO_NIVEL.ruim.fundo } : undefined}
                  >
                    <td className={cn(TD, "text-muted-foreground")}>{i + 1}</td>
                    <td className={cn(TD, "max-w-[280px]")}>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full bg-muted-foreground/50"
                          style={nivel ? { background: COR_DO_NIVEL[nivel].cor } : undefined}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-foreground">{nomeDe(r)}</div>
                          {subDe(r) ? (
                            <div className="truncate text-xs text-muted-foreground">{subDe(r)}</div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    {celula(r, r.totalCtes, "emitidos", "CT-e emitidos")}
                    {celula(r, r.entregue, "entregues", "CT-e entregues")}
                    {celula(r, r.noPrazo, "no_prazo", "CT-e entregues no prazo")}
                    <td className={cn(TD, "text-right")}>{formatarInteiro(r.foraPrazo)}</td>
                    <td className={cn(TD, "text-right text-muted-foreground")}>
                      {formatarInteiro(r.foraCliente)}
                    </td>
                    {celula(
                      r,
                      r.foraTransp,
                      "fora_prazo",
                      `Fora do prazo por culpa da ${nomeCurto}`,
                    )}
                    <td
                      className={cn(TD, "text-right font-bold")}
                      style={nivel ? { color: COR_DO_NIVEL[nivel].texto } : undefined}
                    >
                      {formatarPercentual(r.slaPct)}
                    </td>
                    {celula(r, r.aEntregar, "previstos_por_status", "CT-e a entregar (em aberto)")}
                    {celula(r, r.atrasadas, "em_atraso", "CT-e em aberto com prazo vencido")}
                    <td className={cn(TD, "text-right")}>{formatarDecimal(r.peso, 0)}</td>
                    <td className={cn(TD, "text-right")}>
                      {formatarInteiro(Math.round(r.volumes))}
                    </td>
                    <td className={cn(TD, "text-right whitespace-nowrap")}>
                      {freteVisivel ? (
                        formatarMoeda(r.frete, { centavos: false })
                      ) : (
                        <span className="text-muted-foreground" aria-label="valor oculto">
                          R$ •••••
                        </span>
                      )}
                    </td>
                    <td className="pr-3 text-right">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Painel>
    </Pagina>
  );
}
