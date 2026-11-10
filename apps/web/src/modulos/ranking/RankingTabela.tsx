import { SEM_TIPO_DOCUMENTO } from "@erp/shared/contratos/filtros";
import { type TipoRecorte } from "@erp/shared/contratos/listagem";
import { type PontoSerie as PontoDaSerie } from "@erp/shared/contratos/performance";
import { type FiltroDoRanking, type LinhaDoRanking } from "@erp/shared/contratos/ranking";
import { hojeNoFuso } from "@erp/shared/datas";
import { lerFiltroTexto } from "@erp/shared/filtro-texto";
import { formatarCnpj, formatarPercentual } from "@erp/shared/formatacao";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ChevronRight, Eye, EyeOff } from "lucide-react";
import { useMemo, useState } from "react";

import { consultaAcesso } from "@/acesso/sessao";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { FiltroPeriodo } from "@/componentes/comum/FiltroPeriodo";
import {
  type EtiquetaFiltroOpcional,
  FiltrandoPor,
  resumirNomes,
} from "@/componentes/comum/FiltrosAvancados";
import { GraficoLinha } from "@/componentes/comum/Graficos";
import { KpiCard } from "@/componentes/comum/KpiCard";
import { type Periodo, resolverPeriodo, ROTULO_ATALHO } from "@/componentes/comum/periodo";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { type ColunaExportacao } from "@/lib/exportacao";
import { consultaConfiguracoesPublicas } from "@/modulos/admin/api";
import { consultaPagadores } from "@/modulos/filtros/api";
import {
  type ContextoDosFiltros,
  SeletorDeFilial,
  SeletorDePagador,
  SeletorDeTexto,
  SeletorDeTipoDocumento,
} from "@/modulos/filtros/componentes";
import { nomesDosPagadores } from "@/modulos/filtros/regras";
import { caminhoDaLista } from "@/modulos/listagem/busca";

import { consultaRankingOperacional, consultaSerieMensal } from "./api";
import { diaCurto } from "./periodo";
import {
  type ChaveDeOrdem,
  COR_DO_NIVEL,
  filtrarPorCard,
  type FiltroDoCard,
  kpisDoRanking,
  limiaresDoSla,
  nivelDoSla,
  ordenarLinhas,
} from "./ranking-tela";

type Base = "emissao" | "prevista";
const ROTULO_DA_BASE: Record<Base, string> = {
  emissao: "data de emissão",
  prevista: "data prevista de entrega",
};

const nfInt = new Intl.NumberFormat("pt-BR");
const nfPeso = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const nfBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

// Preferência do olho do Frete: só conveniência do navegador, vale para as duas abas.
const FRETE_VISIVEL = "ranking:frete-visivel";

function lerFreteVisivel(): boolean {
  try {
    return window.localStorage.getItem(FRETE_VISIVEL) !== "0";
  } catch {
    return true;
  }
}

const CLASSE_DO_BOTAO = "rounded-[5px] px-3 py-1 text-[12px] transition-colors ";
const ATALHOS = ["hoje", "7d", "30d", "mes"] as const;
const classeDoAlternador = (ativo: boolean) =>
  CLASSE_DO_BOTAO +
  (ativo ? "bg-[var(--brand)] text-white" : "text-muted-foreground hover:bg-muted");

export function RankingTabela({ grupo }: { grupo: "pagador" | "cidade" }) {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const fuso = useFusoDaEmpresa();
  const nomeCurto = acesso.empresa?.nomeCurto ?? "transportadora";
  // Q11: "hoje" é o dia da empresa (Brasília), não o do navegador.
  const hoje = hojeNoFuso(fuso);
  const navigate = useNavigate();
  const { data: configuracoes } = useQuery(consultaConfiguracoesPublicas);
  const { meta, alerta } = limiaresDoSla(configuracoes?.valores);

  const [rapido, setRapido] = useState<Periodo>("30d");
  const [base, setBase] = useState<Base>("emissao");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [filiais, setFiliais] = useState<string[]>([]);
  const [parceiros, setParceiros] = useState<string[]>([]);
  const [destino, setDestino] = useState("");
  const [remetente, setRemetente] = useState("");
  const [tipos, setTipos] = useState<string[]>([]);
  const [ordem, setOrdem] = useState<{ chave: ChaveDeOrdem; direcao: "asc" | "desc" }>({
    chave: "slaPct",
    direcao: "desc",
  });
  const [filtroCard, setFiltroCard] = useState<FiltroDoCard>("todos");
  const [freteVisivel, setFreteVisivel] = useState(lerFreteVisivel);

  const intervalo = resolverPeriodo(rapido, de, ate, hoje, "30d");
  const periodo = {
    ...intervalo,
    rotulo:
      rapido === "custom"
        ? `${diaCurto(intervalo.inicio)} → ${diaCurto(intervalo.fim)}`
        : ROTULO_ATALHO[rapido],
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
  const { data, isFetching } = useQuery(consultaRankingOperacional(filtro));
  const linhas = useMemo(() => data ?? [], [data]);

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
  const alternarCard = (f: FiltroDoCard) => {
    setFiltroCard((atual) => (atual === f ? "todos" : f));
  };

  const nomesParceiros = nomesDosPagadores(pagadores.data ?? [], parceiros);
  const rotuloTipos = tipos.map((t) => (t === SEM_TIPO_DOCUMENTO ? "sem tipo" : t)).join(", ");
  const etiquetas: EtiquetaFiltroOpcional[] = [
    nomesParceiros.length > 0 && {
      rotulo: nomesParceiros.length === 1 ? "Parceiro" : "Parceiros",
      ...resumirNomes(nomesParceiros),
      limpar: () => {
        setParceiros([]);
      },
    },
    remetente.trim() !== "" && {
      rotulo: "Remetente",
      ...resumirNomes(lerFiltroTexto(remetente)),
      limpar: () => {
        setRemetente("");
      },
    },
    destino.trim() !== "" && {
      rotulo: "Destino",
      ...resumirNomes(lerFiltroTexto(destino)),
      limpar: () => {
        setDestino("");
      },
    },
    filiais.length > 0 && {
      rotulo: "Unidade responsável",
      valor: filiais.join(", "),
      limpar: () => {
        setFiliais([]);
      },
    },
    tipos.length > 0 && {
      rotulo: "Tipo",
      valor: rotuloTipos,
      limpar: () => {
        setTipos([]);
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

  const celula = (r: LinhaDoRanking, valor: number, tipo: TipoRecorte, dica: string) => (
    <td className="px-2 py-1.5 text-right tabular-nums">
      <button
        type="button"
        title={`Ver: ${dica}`}
        onClick={(e) => {
          e.stopPropagation();
          abrirCasos(r, tipo);
        }}
        className="rounded px-1 underline-offset-2 hover:bg-muted hover:underline"
      >
        {nfInt.format(valor)}
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-border/70 bg-card p-2">
        <FiltroPeriodo
          periodo={rapido}
          de={de}
          ate={ate}
          atalhos={ATALHOS}
          padrao="30d"
          rotulo={base === "emissao" ? "Emissão" : "Previsão"}
          aoMudar={(m) => {
            setRapido(m.periodo);
            setDe(m.de);
            setAte(m.ate);
          }}
        />
        <div
          className="flex rounded-md border border-border/70 p-0.5"
          role="group"
          aria-label="Data usada no período"
        >
          {(["emissao", "prevista"] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => {
                setBase(b);
              }}
              aria-pressed={base === b}
              title={`Recorta o período pela ${ROTULO_DA_BASE[b]} do CT-e`}
              className={classeDoAlternador(base === b)}
            >
              {b === "emissao" ? "Emissão" : "Previsão de entrega"}
            </button>
          ))}
        </div>
        <SeletorDeFilial selecionadas={filiais} contexto={contexto} aoMudar={setFiliais} />
        <SeletorDePagador
          rotulo="Parceiros"
          opcoes={pagadores.data}
          selecionados={parceiros}
          aoMudar={setParceiros}
        />
        <SeletorDeTexto
          rotulo="Remetente"
          campo="remetente"
          valor={remetente}
          contexto={contexto}
          aoMudar={setRemetente}
        />
        <SeletorDeTexto
          rotulo="Destino"
          campo="cidade_destino"
          valor={destino}
          contexto={contexto}
          aoMudar={setDestino}
        />
        <SeletorDeTipoDocumento
          selecionados={tipos}
          escopo={{ inicio: periodo.inicio, fim: periodo.fim, campoData: base }}
          aoMudar={setTipos}
        />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            meta {formatarPercentual(meta)} · {periodo.rotulo}
          </span>
          <ExportMenu
            arquivo={`ranking-${grupo === "pagador" ? "parceiro" : "cidade"}`}
            titulo={`Ranking por ${rotuloDoGrupo}`}
            subtitulo={[`${periodo.rotulo} · por ${ROTULO_DA_BASE[base]}`, descricaoDosFiltros]
              .filter(Boolean)
              .join(" · ")}
            colunas={colunasExportacao}
            linhas={linhasExportacao}
          />
        </div>
      </div>

      <FiltrandoPor etiquetas={etiquetas} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          rotulo={grupo === "pagador" ? "Parceiros" : "Cidades"}
          valor={nfInt.format(kpis.grupos)}
          status="bom"
          neutro
          detalhe="no período · ver todos"
          aoClicar={() => {
            setFiltroCard("todos");
          }}
          ativo={filtroCard === "todos"}
        />
        <KpiCard
          rotulo="CT-e no período"
          valor={nfInt.format(kpis.totalCtes)}
          status="bom"
          neutro
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
          detalhe={`meta ${formatarPercentual(meta)} · ver os que atingem`}
          aoClicar={() => {
            alternarCard("na_meta");
          }}
          ativo={filtroCard === "na_meta"}
        />
        <KpiCard
          rotulo="Abaixo da meta"
          valor={nfInt.format(kpis.abaixoMeta)}
          status={kpis.abaixoMeta > 0 ? "ruim" : "bom"}
          detalhe={`de ${nfInt.format(kpis.grupos)} ${plural}`}
          aoClicar={() => {
            alternarCard("abaixo_meta");
          }}
          ativo={filtroCard === "abaixo_meta"}
        />
      </div>

      <section className="rounded-[10px] border border-border/70 bg-card p-3">
        <header className="mb-2 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[13px] font-semibold">SLA mês a mês — {ano}</h3>
            <p className="text-[11px] text-muted-foreground">
              por {ROTULO_DA_BASE[base]} · não segue o período acima
            </p>
          </div>
          <select
            aria-label="Ano do gráfico"
            value={ano}
            onChange={(e) => {
              setAno(Number(e.target.value));
            }}
            className="rounded-md border border-border bg-card px-2 py-1 text-[12px]"
          >
            {[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </header>
        <GraficoLinha
          descricao={`SLA mês a mês em ${String(ano)}`}
          dados={pontosDoGrafico(serie.data)}
          eixoX="mes"
          series={[{ chave: "sla", nome: "SLA" }]}
          formato="percentual"
          meta={{ valor: meta, rotulo: `meta ${formatarPercentual(meta)}` }}
          dica={(p) =>
            `${p.mes}: SLA ${formatarPercentual(p.sla)} · ${nfInt.format(p.totalCtes)} CT-e`
          }
          carregando={serie.isLoading}
          erro={serie.error}
        />
      </section>

      {filtroCard !== "todos" && (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span>
            Mostrando {nfInt.format(filtradas.length)} de {nfInt.format(linhas.length)} {plural}{" "}
            {rotuloDoFiltro}.
          </span>
          <button
            type="button"
            onClick={() => {
              setFiltroCard("todos");
            }}
            className="text-[var(--brand)] underline-offset-2 hover:underline"
          >
            Ver todos
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-[10px] border border-border/70">
        <table className="w-full text-[14px] font-medium">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr className="border-b border-border/70">
              <th className="px-2 py-2 text-left text-[13px] font-semibold">#</th>
              {cabecalhos.map((h) => {
                const ativo = ordem.chave === h.chave;
                return (
                  <th
                    key={h.chave}
                    onClick={() => {
                      alternarOrdem(h.chave);
                    }}
                    title="Ordenar por esta coluna"
                    className={
                      "cursor-pointer select-none px-2 py-2 text-[13px] font-semibold hover:text-foreground " +
                      (h.alinhar === "right" ? "text-right" : "text-left") +
                      (ativo ? " text-foreground" : "")
                    }
                  >
                    <span className="inline-flex items-center gap-0.5">
                      {h.chave === "frete" ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            alternarFrete();
                          }}
                          title={
                            freteVisivel ? "Ocultar valores de frete" : "Mostrar valores de frete"
                          }
                          aria-label={
                            freteVisivel ? "Ocultar valores de frete" : "Mostrar valores de frete"
                          }
                          className="mr-0.5 rounded p-0.5 hover:bg-muted hover:text-foreground"
                        >
                          {freteVisivel ? (
                            <Eye className="h-3.5 w-3.5" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5" />
                          )}
                        </button>
                      ) : null}
                      {h.rotulo}
                      {ativo ? (
                        ordem.direcao === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : null}
                    </span>
                  </th>
                );
              })}
              <th className="px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {isFetching && linhas.length === 0 && (
              <tr>
                <td colSpan={15} className="px-3 py-8 text-center text-muted-foreground">
                  carregando…
                </td>
              </tr>
            )}
            {!isFetching && linhas.length === 0 && (
              <tr>
                <td colSpan={15} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhum {rotuloDoGrupo.toLowerCase()} no período.
                </td>
              </tr>
            )}
            {linhas.length > 0 && filtradas.length === 0 && (
              <tr>
                <td colSpan={15} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhum {rotuloDoGrupo.toLowerCase()} {rotuloDoFiltro} no período.
                </td>
              </tr>
            )}
            {ordenadas.map((r, i) => {
              const nivel = nivelDoSla(r.slaPct, meta, alerta);
              return (
                <tr
                  key={r.chave}
                  onClick={() => {
                    abrirCasos(r);
                  }}
                  title="Ver todos os CT-e (clique num número para ver só aquela coluna)"
                  className="cursor-pointer border-b border-border/40 last:border-0 hover:bg-muted/40"
                  style={nivel === "ruim" ? { background: COR_DO_NIVEL.ruim.fundo } : undefined}
                >
                  <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full bg-muted-foreground/50"
                        style={nivel ? { background: COR_DO_NIVEL[nivel].cor } : undefined}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{nomeDe(r)}</div>
                        {subDe(r) ? (
                          <div className="truncate text-[11px] font-normal text-muted-foreground">
                            {subDe(r)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  {celula(r, r.totalCtes, "emitidos", "CT-e emitidos")}
                  {celula(r, r.entregue, "entregues", "CT-e entregues")}
                  {celula(r, r.noPrazo, "no_prazo", "CT-e entregues no prazo")}
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {nfInt.format(r.foraPrazo)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                    {nfInt.format(r.foraCliente)}
                  </td>
                  {celula(r, r.foraTransp, "fora_prazo", `Fora do prazo por culpa da ${nomeCurto}`)}
                  <td
                    className="px-2 py-1.5 text-right font-bold tabular-nums"
                    style={nivel ? { color: COR_DO_NIVEL[nivel].texto } : undefined}
                  >
                    {formatarPercentual(r.slaPct)}
                  </td>
                  {celula(r, r.aEntregar, "previstos_por_status", "CT-e a entregar (em aberto)")}
                  {celula(r, r.atrasadas, "em_atraso", "CT-e em aberto com prazo vencido")}
                  <td className="px-2 py-1.5 text-right tabular-nums">{nfPeso.format(r.peso)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {nfInt.format(Math.round(r.volumes))}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {freteVisivel ? (
                      nfBRL.format(r.frete)
                    ) : (
                      <span className="text-muted-foreground" aria-label="valor oculto">
                        R$ •••••
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        SLA = (entregue − atrasos por culpa da transportadora) ÷ entregue — atraso de
        responsabilidade do cliente não penaliza. Clique num número para ver os CT-e daquela coluna,
        ou no resto da linha para ver todos os CT-e do parceiro ou da cidade.
        {grupo === "cidade"
          ? " A cidade considera tudo emitido para ela, independente de parceiro."
          : ""}
      </p>
    </div>
  );
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Ponto do gráfico: SLA do mês = (entregue − fora por culpa da transportadora) ÷ entregue. */
function pontosDoGrafico(pontos: readonly PontoDaSerie[] | undefined) {
  return (pontos ?? []).map((p) => ({
    mes: MESES[Number(p.periodo.slice(5, 7)) - 1] ?? p.periodo,
    sla: p.entregue > 0 ? (p.entregue - p.foraTransp) / p.entregue : null,
    totalCtes: p.totalCtrcs,
  }));
}
