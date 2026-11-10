/**
 * Prazo próprio × Prazo do parceiro (`/prazo-parceiro`): cards, origem do prazo, nascidos em
 * atraso, ranking de parceiros e lista de CT-e. origem: routes/_authenticated/prazo-parceiro.tsx
 */
import {
  FILTROS_DA_LISTA,
  type LinhaPrazo,
  TAMANHOS_DA_LISTA,
} from "@erp/shared/contratos/prazo-parceiro";
import { hojeNoFuso } from "@erp/shared/datas";
import { formatarData } from "@erp/shared/formatacao";
import { useIsFetching, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Info,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { consultaAcesso } from "@/acesso/sessao";
import { BotoesDePagina } from "@/componentes/comum/BotoesDePagina";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";
import {
  type EtiquetaFiltroOpcional,
  FiltrandoPor,
  FiltrosAvancados,
  resumirNomes,
} from "@/componentes/comum/FiltrosAvancados";
import { resolverPeriodo } from "@/componentes/comum/periodo";
import { Button } from "@/componentes/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/componentes/ui/tooltip";
import { useAbrirCte } from "@/hooks/use-abrir-cte";
import { useFiltrosNaUrl } from "@/hooks/use-filtros-na-url";
import { COLUNA_LINK_SSW, type ColunaExportacao, urlCtrcNoSsw } from "@/lib/exportacao";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";

import {
  CHAVE_DO_PRAZO,
  consultaLista,
  consultaOpcoes,
  consultaVisaoGeral,
  exportarLista,
} from "./api";
import {
  esquemaPrazo,
  filtrosDaBusca,
  ROTULO_FILTRO,
  ROTULO_PERIODO,
  tamanhoDaLista,
} from "./busca";
import {
  BotoesDePeriodo,
  CartaoMetrica,
  classeDoSla,
  fmtPP,
  LinhasCarregando,
  nfInt,
  nfPct,
  nfPct0,
  tomDoSla,
} from "./componentes";
import { opcoesDeTipo, rotuloDoTipo } from "./tipos";

const COLUNAS_DA_EXPORTACAO: readonly ColunaExportacao[] = [
  { chave: "numero", titulo: "CTRC" },
  { chave: "parceiroNome", titulo: "Parceiro" },
  { chave: "dataEmbarque", titulo: "Embarque", formato: "data" },
  { chave: "dataPrevista", titulo: "Prazo entrega", formato: "data" },
  { chave: "prazoPadraoData", titulo: "Mínimo 48h", formato: "data" },
  { chave: "diasAbaixoDoPadrao", titulo: "Abaixo do padrão (dias)", formato: "inteiro" },
  { chave: "origem", titulo: "Origem do prazo" },
  { chave: "statusAtual", titulo: "Status" },
  { chave: "setor", titulo: "Setor" },
  { chave: "unidadeNome", titulo: "Unidade" },
  { chave: "nascido", titulo: "Nascido em atraso" },
  { chave: "linkSsw", titulo: COLUNA_LINK_SSW },
];

const paraExportar = (l: LinhaPrazo) => ({
  ...l,
  origem: l.prazoOrigem === "parceiro" ? "Parceiro" : "Próprio",
  nascido: l.nasceuAtrasado ? "Sim" : "Não",
  linkSsw: urlCtrcNoSsw(l.sigla, l.numero, l.dataEmissao),
});

export function PaginaPrazoParceiro() {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const nomeCurto = acesso.empresa?.nomeCurto ?? "transportadora";
  const { filtros: b, definir } = useFiltrosNaUrl(esquemaPrazo);
  const navigate = useNavigate();
  const abrirCte = useAbrirCte();
  const queryClient = useQueryClient();
  const atualizando = useIsFetching({ queryKey: CHAVE_DO_PRAZO }) > 0;

  const intervalo = resolverPeriodo(
    b.periodo,
    "",
    "",
    hojeNoFuso(acesso.empresa?.fuso ?? "America/Sao_Paulo"),
  );
  const filtros = filtrosDaBusca(b, intervalo);
  const visao = useQuery(consultaVisaoGeral(filtros));
  const opcoes = useQuery(consultaOpcoes(intervalo)).data;
  const entradaDaLista = {
    filtros,
    filtro: b.filtro,
    pagina: b.page,
    tamanho: tamanhoDaLista(b.size),
  };
  const lista = useQuery(consultaLista(entradaDaLista));

  const t = visao.data?.totais;
  const a = visao.data?.comparacao;
  const sla = visao.data?.sla ?? { meta: 0.95, alerta: 0.9 };
  const ranking = visao.data?.ranking ?? [];
  const totalDePaginas = Math.max(1, Math.ceil((lista.data?.total ?? 0) / b.size));
  const mudar = (m: Partial<typeof b>) => {
    definir({ ...m, page: 1 });
  };

  const bannerPositivo = t && t.diferencaPp > 0.03;
  const bannerVariacao = a?.deltaGapPp != null && Math.abs(a.deltaGapPp) > 0.05;
  const parceiroProblema = ranking.find((p) => p.pctNascidos > 0.3 && p.nascidosAtrasados >= 3);

  /** Nomes dos marcados; enquanto as opções não chegam, só a contagem (nunca o id). */
  const nomes = (
    ids: readonly string[],
    lista: readonly { id: string; nome: string }[] | undefined,
  ) => {
    const achados = ids.flatMap((id) => lista?.find((o) => o.id === id)?.nome ?? []);
    return achados.length === ids.length ? resumirNomes(achados) : null;
  };
  const etiquetas: EtiquetaFiltroOpcional[] = [
    b.unidades.length > 0 && {
      rotulo: "Unidades",
      ...(nomes(b.unidades, opcoes?.unidades) ?? {
        valor: b.unidades.length === 1 ? "1 selecionada" : `${b.unidades.length} selecionadas`,
      }),
      limpar: () => {
        mudar({ unidades: [] });
      },
    },
    b.parceiros.length > 0 && {
      rotulo: "Parceiros",
      ...(nomes(b.parceiros, opcoes?.parceiros) ?? {
        valor: b.parceiros.length === 1 ? "1 selecionado" : `${b.parceiros.length} selecionados`,
      }),
      limpar: () => {
        mudar({ parceiros: [] });
      },
    },
    b.tipos.length > 0 && {
      rotulo: "Tipo documento",
      ...resumirNomes(b.tipos.map(rotuloDoTipo)),
      limpar: () => {
        mudar({ tipos: [] });
      },
    },
  ];

  const verLista = () => {
    mudar({ filtro: "nascidos" });
    requestAnimationFrame(() => {
      document
        .getElementById("lista-ctrcs")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const carregarParaExportar = async () => {
    const r = await exportarLista({ filtros, filtro: b.filtro });
    if (r.truncada) {
      toast.warning(
        "A exportação traz só os primeiros 20.000 CTRC. Reduza o período para ver todos.",
      );
    }
    return r.linhas.map(paraExportar);
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[24px] font-medium tracking-tight">
            <Scale className="h-5 w-5" /> Prazo próprio × Prazo do parceiro
          </h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Entenda quanto do seu atraso veio de fora
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          disabled={atualizando}
          onClick={() => void queryClient.invalidateQueries({ queryKey: CHAVE_DO_PRAZO })}
        >
          <RefreshCw className={cn("mr-1.5 h-3 w-3", atualizando && "animate-spin")} /> Atualizar
        </Button>
      </header>

      <FiltrosAvancados
        ativos={b.unidades.length > 0 || b.parceiros.length > 0 || b.tipos.length > 0}
        aoLimpar={() => {
          mudar({ unidades: [], parceiros: [], tipos: [] });
        }}
      >
        <BotoesDePeriodo
          atual={b.periodo}
          aoMudar={(periodo) => {
            mudar({ periodo });
          }}
        />
        <FiltroMultiplo
          rotulo="Unidades"
          opcoes={opcoes?.unidades.map((u) => ({ valor: u.id, rotulo: u.nome }))}
          selecionados={b.unidades}
          aoMudar={(unidades) => {
            mudar({ unidades });
          }}
          textoVazio="todos"
        />
        <FiltroMultiplo
          rotulo="Parceiros"
          opcoes={opcoes?.parceiros.map((p) => ({ valor: p.id, rotulo: p.nome }))}
          selecionados={b.parceiros}
          aoMudar={(parceiros) => {
            mudar({ parceiros });
          }}
          textoVazio="todos"
        />
        <FiltroMultiplo
          rotulo="Tipo documento"
          opcoes={opcoes && opcoesDeTipo(opcoes.tipos)}
          selecionados={b.tipos}
          aoMudar={(tipos) => {
            mudar({ tipos });
          }}
          textoVazio="todos"
        />
        <span className="ml-auto text-[11px] text-muted-foreground">
          {ROTULO_PERIODO[b.periodo]}
        </span>
      </FiltrosAvancados>

      <FiltrandoPor etiquetas={etiquetas} />

      {visao.isError && (
        <p className="rounded-[10px] border border-[var(--status-bad)]/40 bg-[var(--status-bad-bg)] px-3 py-2 text-[12px] text-[var(--status-bad-fg)]">
          {mensagemAmigavel(visao.error)}
        </p>
      )}
      {bannerPositivo && (
        <div className="flex items-start gap-2 rounded-[10px] border border-emerald-300 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
          <TrendingUp className="mt-0.5 h-3.5 w-3.5" />
          <span>
            Sua performance real é <strong>{fmtPP(t.diferencaPp)}</strong> melhor do que aparece.{" "}
            <strong>{nfInt.format(t.nascidosAtrasados)}</strong> CTRC(s) foram emitidos a menos de
            48 horas da previsão de entrega neste período.
          </span>
        </div>
      )}
      {parceiroProblema && (
        <div className="flex items-start gap-2 rounded-[10px] border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
          <span>
            Atenção: o parceiro <strong>{parceiroProblema.nome}</strong> está enviando muitas cargas
            com menos de 48 horas de prazo (
            <strong>{nfPct0.format(parceiroProblema.pctNascidos)}</strong> neste período). Vale uma
            conversa comercial.
          </span>
        </div>
      )}
      {bannerVariacao && a.deltaGapPp !== null && (
        <div className="flex items-start gap-2 rounded-[10px] border border-border/70 bg-card px-3 py-2 text-[12px]">
          {a.deltaGapPp > 0 ? (
            <TrendingUp className="mt-0.5 h-3.5 w-3.5 text-amber-700" />
          ) : (
            <TrendingDown className="mt-0.5 h-3.5 w-3.5 text-emerald-700" />
          )}
          <span>
            O impacto de prazos herdados {a.deltaGapPp > 0 ? "aumentou" : "diminuiu"}{" "}
            <strong>{fmtPP(Math.abs(a.deltaGapPp))}</strong> em relação ao período anterior.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <CartaoMetrica
          rotulo="Performance total"
          selo="como o SSW mostra"
          valor={t ? nfPct.format(t.performanceTotal) : "—"}
          tom={t && tomDoSla(t.performanceTotal, sla)}
          dica="considerando todos os CTRCs"
          carregando={visao.isLoading}
        />
        <CartaoMetrica
          rotulo="Performance própria"
          selo="responsabilidade real"
          seloDaMarca
          valor={t ? nfPct.format(t.performancePropria) : "—"}
          tom={t && tomDoSla(t.performancePropria, sla)}
          dica="apenas CTRCs com prazo próprio"
          carregando={visao.isLoading}
          destaque
        />
        <CartaoMetrica
          rotulo="Diferença"
          selo="atribuído a parceiros"
          valor={t ? fmtPP(t.diferencaPp) : "—"}
          tom={t && t.diferencaPp > 0 ? "good" : "neutral"}
          dica="o quanto sua performance está sendo puxada para baixo por prazos herdados"
          carregando={visao.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-[10px] border border-border/70 bg-card p-3">
          <h2 className="text-[14px] font-medium">Origem do prazo</h2>
          <p className="text-[11px] text-muted-foreground">Distribuição dos CTRCs no período</p>
          {visao.isLoading ? (
            <div className="mt-4 h-16 animate-pulse rounded bg-muted/60" />
          ) : t && t.totalCtes > 0 ? (
            <>
              <div className="mt-4 flex h-4 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-[var(--brand)]"
                  style={{ width: `${t.pctPrazoProprio * 100}%` }}
                />
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${t.pctPrazoParceiro * 100}%` }}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[var(--brand)]" /> Prazo próprio
                  </div>
                  <div className="mt-0.5 text-[18px] font-medium tabular-nums">
                    {nfInt.format(t.totalProprio)}{" "}
                    <span className="text-[11px] text-muted-foreground">
                      ({nfPct0.format(t.pctPrazoProprio)})
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-400" /> Prazo do parceiro
                  </div>
                  <div className="mt-0.5 text-[18px] font-medium tabular-nums">
                    {nfInt.format(t.totalParceiro)}{" "}
                    <span className="text-[11px] text-muted-foreground">
                      ({nfPct0.format(t.pctPrazoParceiro)})
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                {nfInt.format(t.totalParceiro)} CTRC(s) usaram o prazo importado do parceiro neste
                período.
              </p>
            </>
          ) : (
            <p className="mt-4 text-[12px] text-muted-foreground">Sem CTRCs no período filtrado.</p>
          )}
        </div>

        <div className="rounded-[10px] border border-border/70 bg-card p-3">
          <div className="flex items-center gap-1.5">
            <h2 className="text-[14px] font-medium">Nascidos em atraso</h2>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="O que conta como nascido em atraso"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[300px] text-[11px] leading-snug">
                  CTRCs emitidos a menos de 48 horas (corridas) da previsão de entrega. A{" "}
                  {nomeCurto} não teria como cumprir: o atraso é do parceiro. CTRCs da TROCA ficam
                  fora da conta. Só compara prazos — ocorrências, inclusive as de responsabilidade
                  do cliente, não entram.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Emitido a menos de 48 horas da previsão de entrega
          </p>
          {visao.isLoading ? (
            <div className="mt-4 h-16 animate-pulse rounded bg-muted/60" />
          ) : (
            <>
              <div className="mt-3 text-[36px] font-medium tabular-nums">
                {nfInt.format(t?.nascidosAtrasados ?? 0)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                CTRC(s) no período
                {t?.pctNascidos != null && (
                  <> · {nfPct0.format(t.pctNascidos)} dos CTRCs avaliados</>
                )}
                {a && a.deltaNascidos !== 0 && (
                  <span
                    className={cn(
                      "ml-2",
                      a.deltaNascidos > 0 ? "text-[var(--status-bad)]" : "text-emerald-700",
                    )}
                  >
                    {a.deltaNascidos > 0 ? `+${a.deltaNascidos}` : a.deltaNascidos} vs período
                    anterior
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 h-7 text-[12px]"
                onClick={verLista}
              >
                Ver lista <ArrowRight className="ml-1.5 h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-[10px] border border-border/70 bg-card">
        <div className="border-b border-border/70 p-3">
          <h2 className="text-[14px] font-medium">
            Parceiros com mais prazos inviáveis no período
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Top 10 — clique para abrir o detalhe do parceiro
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="border-b border-border/70">
                <th className="px-3 py-1.5 text-left font-normal">Parceiro</th>
                <th className="px-3 py-1.5 text-right font-normal">CTRCs</th>
                <th className="px-3 py-1.5 text-right font-normal">Prazo do parceiro</th>
                <th className="px-3 py-1.5 text-right font-normal">Nascidos em atraso</th>
                <th className="px-3 py-1.5 text-right font-normal">Performance</th>
                <th className="px-3 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {visao.isLoading && <LinhasCarregando linhas={5} colunas={6} />}
              {visao.isSuccess && ranking.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                    Sem dados no período.
                  </td>
                </tr>
              )}
              {ranking.slice(0, 10).map((p) => (
                <tr
                  key={p.id}
                  onClick={() =>
                    void navigate({
                      to: "/prazo-parceiro/$id",
                      params: { id: p.id },
                      search: { periodo: b.periodo, unidades: b.unidades, tipos: b.tipos },
                    })
                  }
                  className="cursor-pointer border-b border-border/40 last:border-0 hover:bg-muted/40"
                >
                  <td className="px-3 py-1.5">
                    <div className="font-medium">{p.nome}</div>
                    {p.usaSsw && <span className="text-[10px] text-muted-foreground">usa SSW</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{nfInt.format(p.total)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {nfInt.format(p.qtdParceiro)}{" "}
                    <span className="text-muted-foreground">({nfPct0.format(p.pctParceiro)})</span>
                  </td>
                  <td
                    className={cn(
                      "px-3 py-1.5 text-right tabular-nums",
                      p.pctNascidos > 0.1 && "font-medium text-[var(--status-bad)]",
                    )}
                  >
                    {nfInt.format(p.nascidosAtrasados)}{" "}
                    <span className="opacity-75">({nfPct0.format(p.pctNascidos)})</span>
                  </td>
                  <td
                    className={cn(
                      "px-3 py-1.5 text-right tabular-nums",
                      classeDoSla(p.performanceComParceiro, sla),
                    )}
                  >
                    {nfPct.format(p.performanceComParceiro)}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <ChevronRight className="inline h-3.5 w-3.5 text-muted-foreground" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div id="lista-ctrcs" className="scroll-mt-4 rounded-[10px] border border-border/70 bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 p-2">
          <div role="group" className="flex rounded-md border border-border/70 p-0.5">
            {FILTROS_DA_LISTA.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={b.filtro === f}
                onClick={() => {
                  mudar({ filtro: f });
                }}
                className={cn(
                  "rounded-[5px] px-3 py-1 text-[12px] transition-colors",
                  b.filtro === f
                    ? "bg-[var(--brand)] text-white"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {ROTULO_FILTRO[f]}
              </button>
            ))}
          </div>
          <ExportMenu
            className="ml-auto"
            arquivo={`prazo-parceiro-${b.periodo}`}
            titulo="Prazo do parceiro"
            subtitulo={ROTULO_PERIODO[b.periodo]}
            colunas={COLUNAS_DA_EXPORTACAO}
            linhas={[]}
            carregarLinhas={carregarParaExportar}
            formatos={["csv", "excel"]}
            desabilitado={lista.isLoading}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="border-b border-border/70">
                <th className="px-3 py-1.5 text-left font-normal">CTRC</th>
                <th className="px-3 py-1.5 text-left font-normal">Parceiro</th>
                <th className="px-3 py-1.5 text-left font-normal">Embarque</th>
                <th className="px-3 py-1.5 text-left font-normal">Prazo entrega</th>
                <th className="px-3 py-1.5 text-left font-normal">Mínimo 48h</th>
                <th className="px-3 py-1.5 text-right font-normal">Abaixo do padrão (dias)</th>
                <th className="px-3 py-1.5 text-left font-normal">Origem</th>
                <th className="px-3 py-1.5 text-left font-normal">Status</th>
                <th className="px-3 py-1.5 text-left font-normal">Setor</th>
                <th className="px-3 py-1.5 text-left font-normal">Unidade</th>
              </tr>
            </thead>
            <tbody>
              {lista.isLoading && <LinhasCarregando linhas={6} colunas={10} />}
              {lista.isError && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-destructive">
                    {mensagemAmigavel(lista.error)}
                  </td>
                </tr>
              )}
              {lista.isSuccess && lista.data.linhas.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-muted-foreground">
                    Não há CTRCs com prazo do parceiro no período filtrado. Tente ampliar o período.
                  </td>
                </tr>
              )}
              {lista.data?.linhas.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => {
                    abrirCte(l.numero);
                  }}
                  className="cursor-pointer border-b border-border/40 last:border-0 hover:bg-muted/40"
                >
                  <td className="px-3 py-1.5 font-mono text-[11px] text-[var(--brand)]">
                    {l.numero}
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-1.5">{l.parceiroNome ?? "—"}</td>
                  <td className="px-3 py-1.5">{formatarData(l.dataEmbarque)}</td>
                  <td className="px-3 py-1.5">{formatarData(l.dataPrevista)}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {formatarData(l.prazoPadraoData)}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-1.5 text-right tabular-nums",
                      l.nasceuAtrasado && "font-medium text-[var(--status-bad)]",
                    )}
                  >
                    {l.diasAbaixoDoPadrao ?? "—"}
                  </td>
                  <td className="px-3 py-1.5">
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-px text-[10px]",
                        l.prazoOrigem === "parceiro"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {l.prazoOrigem === "parceiro" ? "Parceiro" : "Próprio"}
                    </span>
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-1.5 text-muted-foreground">
                    {l.statusAtual ?? "—"}
                  </td>
                  <td className="px-3 py-1.5 font-mono">{l.setor ?? "—"}</td>
                  <td className="max-w-[140px] truncate px-3 py-1.5">{l.unidadeNome ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-3 py-2 text-[12px]">
          <label className="flex items-center gap-2 text-muted-foreground">
            <span>Linhas por página:</span>
            <select
              className="rounded border border-border/70 bg-background px-1 py-0.5 text-[12px]"
              value={b.size}
              onChange={(e) => {
                mudar({ size: tamanhoDaLista(Number(e.target.value)) });
              }}
            >
              {TAMANHOS_DA_LISTA.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span className="ml-2">{nfInt.format(lista.data?.total ?? 0)} CTRC(s)</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              Página {b.page} de {totalDePaginas}
            </span>
            <BotoesDePagina
              pagina={b.page}
              totalDePaginas={totalDePaginas}
              aoMudar={(page) => {
                definir({ page });
              }}
              className="h-7"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
