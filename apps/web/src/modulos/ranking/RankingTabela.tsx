import { type FiltroDoRanking, type LinhaDoRanking } from "@erp/shared/contratos/ranking";
import { type PontoDaSerie } from "@erp/shared/contratos/sla-serie";
import { formatarCnpj } from "@erp/shared/formatacao";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ChevronRight, Download, Eye, EyeOff } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { consultaAcesso } from "@/acesso/sessao";
import { Button } from "@/componentes/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";

import { consultaRankingOperacional, consultaSerieMensal } from "./api";
import {
  baixarCsv,
  type ColunaDeExportacao,
  COR_DO_STATUS,
  FUNDO_DO_STATUS,
  KpiCard,
  TEXTO_DO_STATUS,
} from "./kit-local";
import { isoLocal, type PeriodoRapido, resolverPeriodo } from "./periodo";
import {
  ALERTA_PADRAO,
  caminhoDaLista,
  type ChaveDeOrdem,
  filtrarPorCard,
  type FiltroDoCard,
  formatarPct,
  kpisDoRanking,
  META_PADRAO,
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
const classeDoAlternador = (ativo: boolean) =>
  CLASSE_DO_BOTAO +
  (ativo ? "bg-[var(--brand)] text-white" : "text-muted-foreground hover:bg-muted");

/** Recorte da Listagem detalhada aberto pelo clique em cada coluna. */
type Recorte =
  "emitidos" | "entregues" | "no_prazo" | "fora_prazo" | "previstos_por_status" | "em_atraso";

export function RankingTabela({ grupo }: { grupo: "pagador" | "cidade" }) {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const nomeCurto = acesso.empresa?.nomeCurto ?? "transportadora";
  const navigate = useNavigate();
  const meta = META_PADRAO;
  const alerta = ALERTA_PADRAO;

  const [rapido, setRapido] = useState<PeriodoRapido>("30d");
  const [base, setBase] = useState<Base>("emissao");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [parceiros, setParceiros] = useState<string[]>([]);
  const [destino, setDestino] = useState("");
  const [remetente, setRemetente] = useState("");
  const [ordem, setOrdem] = useState<{ chave: ChaveDeOrdem; direcao: "asc" | "desc" }>({
    chave: "slaPct",
    direcao: "desc",
  });
  const [filtroCard, setFiltroCard] = useState<FiltroDoCard>("todos");
  const [freteVisivel, setFreteVisivel] = useState(lerFreteVisivel);

  const periodo = useMemo(() => resolverPeriodo(rapido, new Date(), de, ate), [rapido, de, ate]);
  // TODO(kit-ui): seletores de Unidade responsável e Tipo de documento (FilialPicker,
  // TipoDocumentoPicker) e autocomplete de Remetente/Destino quando o kit trouxer.
  const filtro: FiltroDoRanking = {
    grupo,
    inicio: periodo.inicio,
    fim: periodo.fim,
    baseData: base,
    pagadores: parceiros.length ? parceiros : null,
    destino: destino.trim() || null,
    remetente: remetente.trim() || null,
  };
  const { data, isFetching } = useQuery(consultaRankingOperacional(filtro));
  const linhas = useMemo(() => data ?? [], [data]);

  // Opções de Parceiros: os pagadores com CT-e no período (o ranking por parceiro, sem filtros).
  const { data: pagadores = [] } = useQuery(
    consultaRankingOperacional({
      grupo: "pagador",
      inicio: periodo.inicio,
      fim: periodo.fim,
      baseData: base,
    }),
  );

  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  // No ano corrente vai só até hoje: os meses seguintes não têm emissão.
  const fimSerie = ano === anoAtual ? isoLocal(new Date()) : `${ano}-12-31`;
  const serie = useQuery(
    consultaSerieMensal({
      granularidade: "mes",
      inicio: `${ano}-01-01`,
      fim: fimSerie,
      base_data: base,
      parceiros: parceiros.length ? parceiros : undefined,
      destino: destino.trim() || undefined,
      remetente: remetente.trim() || undefined,
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

  // Clique no número abre o recorte daquela coluna; no resto da linha, todos os CT-e dela.
  const abrirCasos = (r: LinhaDoRanking, tipo: Recorte = "emitidos") => {
    void navigate({
      href: caminhoDaLista({
        tipo,
        periodo: "custom",
        de: periodo.inicio,
        ate: periodo.fim,
        base,
        parceiros: grupo === "pagador" ? [r.chave] : parceiros,
        destino: grupo === "cidade" ? nomeDe(r) : destino.trim(),
        remetente: remetente.trim(),
      }),
    });
  };

  const celula = (r: LinhaDoRanking, valor: number, tipo: Recorte, dica: string) => (
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

  const colunasExportacao: ColunaDeExportacao<LinhaDoRanking>[] = [
    { cabecalho: rotuloDoGrupo, valor: nomeDe },
    { cabecalho: "CT-e", valor: (r) => r.totalCtes },
    { cabecalho: "Entregue", valor: (r) => r.entregue },
    { cabecalho: "No Prazo", valor: (r) => r.noPrazo },
    { cabecalho: "Fora Prazo", valor: (r) => r.foraPrazo },
    { cabecalho: "Cliente", valor: (r) => r.foraCliente },
    { cabecalho: "Transp.", valor: (r) => r.foraTransp },
    {
      cabecalho: "SLA (%)",
      valor: (r) => (r.slaPct === null ? "" : +(r.slaPct * 100).toFixed(1)),
    },
    { cabecalho: "A Entregar", valor: (r) => r.aEntregar },
    { cabecalho: "Atrasadas", valor: (r) => r.atrasadas },
    { cabecalho: "No Prazo (aberto)", valor: (r) => r.noPrazoAberto },
    { cabecalho: "Peso (kg)", valor: (r) => Math.round(r.peso) },
    { cabecalho: "Volumes", valor: (r) => Math.round(r.volumes) },
    ...(freteVisivel
      ? [{ cabecalho: "Frete (R$)", valor: (r: LinhaDoRanking) => +r.frete.toFixed(2) }]
      : []),
  ];

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
        <div className="flex rounded-md border border-border/70 p-0.5">
          {(["hoje", "7d", "30d", "mes"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setRapido(p);
                setDe("");
                setAte("");
              }}
              className={classeDoAlternador(rapido === p)}
            >
              {p === "hoje" ? "Hoje" : p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "Mês"}
            </button>
          ))}
        </div>
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
        <div className="flex items-center gap-1 text-[12px]">
          <input
            type="date"
            aria-label="De"
            value={de}
            onChange={(e) => {
              setDe(e.target.value);
              if (e.target.value && ate) setRapido("custom");
            }}
            className="rounded-md border border-border bg-card px-2 py-1"
          />
          <span className="text-muted-foreground">→</span>
          <input
            type="date"
            aria-label="Até"
            value={ate}
            onChange={(e) => {
              setAte(e.target.value);
              if (de && e.target.value) setRapido("custom");
            }}
            className="rounded-md border border-border bg-card px-2 py-1"
          />
        </div>
        <SeletorDeParceiros opcoes={pagadores} selecionados={parceiros} aoMudar={setParceiros} />
        <input
          aria-label="Remetente"
          placeholder="Remetente (a|b)"
          value={remetente}
          onChange={(e) => {
            setRemetente(e.target.value);
          }}
          className="w-40 rounded-md border border-border bg-card px-2 py-1 text-[12px]"
        />
        <input
          aria-label="Destino"
          placeholder="Destino (a|b)"
          value={destino}
          onChange={(e) => {
            setDestino(e.target.value);
          }}
          className="w-40 rounded-md border border-border bg-card px-2 py-1 text-[12px]"
        />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            meta {formatarPct(meta)} · {periodo.rotulo}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[12px]"
            onClick={() => {
              baixarCsv(`ranking-${grupo}`, colunasExportacao, ordenadas);
            }}
          >
            <Download className="mr-1 h-3.5 w-3.5" /> Exportar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          rotulo={grupo === "pagador" ? "Parceiros" : "Cidades"}
          valor={nfInt.format(kpis.grupos)}
          status="good"
          neutro
          meta="no período · ver todos"
          aoClicar={() => {
            setFiltroCard("todos");
          }}
          ativo={filtroCard === "todos"}
        />
        <KpiCard
          rotulo="CT-e no período"
          valor={nfInt.format(kpis.totalCtes)}
          status="good"
          neutro
          meta={periodo.rotulo}
          aoClicar={() => {
            setFiltroCard("todos");
          }}
          ativo={filtroCard === "todos"}
        />
        <KpiCard
          rotulo="SLA médio"
          valor={formatarPct(kpis.slaMedio)}
          status={statusDoSlaMedio ?? "good"}
          neutro={statusDoSlaMedio === null}
          progresso={kpis.slaMedio ?? undefined}
          meta={`meta ${formatarPct(meta)} · ver os que atingem`}
          aoClicar={() => {
            alternarCard("na_meta");
          }}
          ativo={filtroCard === "na_meta"}
        />
        <KpiCard
          rotulo="Abaixo da meta"
          valor={nfInt.format(kpis.abaixoMeta)}
          status={kpis.abaixoMeta > 0 ? "bad" : "good"}
          meta={`de ${nfInt.format(kpis.grupos)} ${plural}`}
          aoClicar={() => {
            alternarCard("abaixo_meta");
          }}
          ativo={filtroCard === "abaixo_meta"}
        />
      </div>

      <SerieMensal
        titulo={`SLA mês a mês — ${ano}`}
        subtitulo={`por ${ROTULO_DA_BASE[base]} · não segue o período acima`}
        pontos={serie.data}
        carregando={serie.isFetching}
        erro={serie.error}
        meta={meta}
        alerta={alerta}
        seletorDeAno={
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
        }
      />

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
                  style={nivel === "bad" ? { background: FUNDO_DO_STATUS.bad } : undefined}
                >
                  <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full bg-muted-foreground/50"
                        style={nivel ? { background: COR_DO_STATUS[nivel] } : undefined}
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
                    style={nivel ? { color: TEXTO_DO_STATUS[nivel] } : undefined}
                  >
                    {formatarPct(r.slaPct)}
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

/** TODO(kit-ui): trocar pelo PagadorPicker do kit (com busca e "agrupados por nome"). */
function SeletorDeParceiros({
  opcoes,
  selecionados,
  aoMudar,
}: {
  opcoes: LinhaDoRanking[];
  selecionados: string[];
  aoMudar: (v: string[]) => void;
}) {
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLowerCase();
  const visiveis = opcoes
    .filter(
      (o) => !termo || (o.rotulo ?? "").toLowerCase().includes(termo) || o.chave.includes(termo),
    )
    .sort((a, b) => (a.rotulo ?? a.chave).localeCompare(b.rotulo ?? b.chave, "pt-BR"));
  const alternar = (cnpj: string) => {
    aoMudar(
      selecionados.includes(cnpj)
        ? selecionados.filter((c) => c !== cnpj)
        : [...selecionados, cnpj].sort(),
    );
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-md border border-border bg-card px-2 py-1 text-[12px] hover:bg-muted"
        >
          Parceiros{selecionados.length ? ` (${selecionados.length})` : ""}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2">
        <input
          placeholder="Buscar parceiro ou CNPJ"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
          }}
          className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1 text-[12px]"
        />
        <div className="max-h-64 space-y-0.5 overflow-auto">
          {visiveis.map((o) => (
            <label
              key={o.chave}
              className="flex items-center gap-2 rounded px-1 py-0.5 text-[12px] hover:bg-muted"
            >
              <input
                type="checkbox"
                checked={selecionados.includes(o.chave)}
                onChange={() => {
                  alternar(o.chave);
                }}
              />
              <span className="truncate">{o.rotulo ?? formatarCnpj(o.chave)}</span>
              <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                {nfInt.format(o.totalCtes)}
              </span>
            </label>
          ))}
          {visiveis.length === 0 && (
            <p className="p-2 text-center text-[12px] text-muted-foreground">Nenhum parceiro.</p>
          )}
        </div>
        {selecionados.length > 0 && (
          <button
            type="button"
            onClick={() => {
              aoMudar([]);
            }}
            className="mt-2 text-[12px] text-[var(--brand)] hover:underline"
          >
            Limpar
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * Gráfico mês a mês do SLA do ranking e do volume de CT-e.
 * TODO(kit-ui): trocar pelo SlaSerieChart do kit (Recharts, exportação e captura no PDF).
 */
function SerieMensal({
  titulo,
  subtitulo,
  pontos,
  carregando,
  erro,
  meta,
  alerta,
  seletorDeAno,
}: {
  titulo: string;
  subtitulo: string;
  pontos: PontoDaSerie[] | undefined;
  carregando: boolean;
  erro: Error | null;
  meta: number;
  alerta: number;
  seletorDeAno: ReactNode;
}) {
  const maiorVolume = Math.max(1, ...(pontos ?? []).map((p) => p.totalCtrcs));
  return (
    <section className="rounded-[10px] border border-border/70 bg-card p-3">
      <header className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-semibold">{titulo}</h3>
          <p className="text-[11px] text-muted-foreground">{subtitulo}</p>
        </div>
        {seletorDeAno}
      </header>
      {erro ? (
        <p className="py-6 text-center text-[12px] text-destructive">{erro.message}</p>
      ) : !pontos ? (
        <p className="py-6 text-center text-[12px] text-muted-foreground">
          {carregando ? "carregando…" : "Sem dados."}
        </p>
      ) : (
        <div className="flex h-40 items-end gap-1">
          {pontos.map((p) => {
            const sla = p.entregue > 0 ? (p.entregue - p.foraTransp) / p.entregue : null;
            const nivel = nivelDoSla(sla, meta, alerta);
            const mes = MESES[Number(p.periodo.slice(5, 7)) - 1] ?? p.periodo;
            return (
              <div
                key={p.periodo}
                className="flex flex-1 flex-col items-center gap-1"
                title={`${mes}: SLA ${formatarPct(sla)} · ${nfInt.format(p.totalCtrcs)} CT-e`}
              >
                <span
                  className="text-[10px] font-semibold tabular-nums"
                  style={nivel ? { color: TEXTO_DO_STATUS[nivel] } : undefined}
                >
                  {formatarPct(sla)}
                </span>
                <div
                  className="w-full rounded-t bg-[var(--brand)]/30"
                  style={{ height: `${Math.max(2, (p.totalCtrcs / maiorVolume) * 100)}px` }}
                />
                <span className="text-[10px] text-muted-foreground">{mes}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
