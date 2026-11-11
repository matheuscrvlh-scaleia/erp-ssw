/**
 * Prazo próprio × Prazo do parceiro (`/prazo-parceiro`): cards, origem do prazo, nascidos em
 * atraso, ranking de parceiros e lista de CT-e. origem: routes/_authenticated/prazo-parceiro.tsx
 */
import { type SaidaDe } from "@erp/shared/contrato";
import {
  type contratosPrazoParceiro,
  type FiltroDaLista,
  FILTROS_DA_LISTA,
  type LinhaPrazo,
  TAMANHOS_DA_LISTA,
} from "@erp/shared/contratos/prazo-parceiro";
import { hojeNoFuso } from "@erp/shared/datas";
import {
  formatarData,
  formatarInteiro,
  formatarPercentual,
  formatarPontos,
} from "@erp/shared/formatacao";
import { useIsFetching, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  ChartPie,
  ChevronRight,
  Clock4,
  Gauge,
  RefreshCw,
  Scale,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { consultaAcesso } from "@/acesso/sessao";
import { Alternador } from "@/componentes/comum/Alternador";
import { Aviso } from "@/componentes/comum/Aviso";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";
import {
  type EtiquetaFiltroOpcional,
  FiltrandoPor,
  FiltrosAvancados,
  resumirNomes,
} from "@/componentes/comum/FiltrosAvancados";
import { InfoTip } from "@/componentes/comum/InfoTip";
import { KpiCard } from "@/componentes/comum/KpiCard";
import { Painel } from "@/componentes/comum/Painel";
import { resolverPeriodo } from "@/componentes/comum/periodo";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { type ColunaTabela } from "@/componentes/comum/tabela-dados";
import { TabelaDados } from "@/componentes/comum/TabelaDados";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/componentes/ui/select";
import { Skeleton } from "@/componentes/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/componentes/ui/tooltip";
import { useAbrirCte } from "@/hooks/use-abrir-cte";
import { useFiltrosNaUrl } from "@/hooks/use-filtros-na-url";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { COLUNA_LINK_SSW, type ColunaExportacao, urlCtrcNoSsw } from "@/lib/exportacao";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";
import { SeloDosDados } from "@/modulos/ingestao-ssw/SeloDosDados";

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
import { AlternadorDePeriodo, COR_DA_ORIGEM, EtiquetaDeOrigem, NumeroDoCtrc } from "./pecas";
import { SELO_DO_SLA, tomDoSla } from "./sla";
import { opcoesDeTipo, rotuloDoTipo } from "./tipos";

type VisaoGeral = SaidaDe<typeof contratosPrazoParceiro.visaoGeral>;
type LinhaDoRanking = VisaoGeral["ranking"][number];
type TotaisDoPrazo = VisaoGeral["totais"];

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
  const fuso = useFusoDaEmpresa();
  const nomeCurto = acesso.empresa?.nomeCurto ?? "transportadora";
  const { filtros: b, definir } = useFiltrosNaUrl(esquemaPrazo);
  const navigate = useNavigate();
  const abrirCte = useAbrirCte();
  const queryClient = useQueryClient();
  const atualizando = useIsFetching({ queryKey: CHAVE_DO_PRAZO }) > 0;

  const intervalo = resolverPeriodo(b.periodo, "", "", hojeNoFuso(fuso));
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

  /** Muda o filtro da lista e rola até ela (botão "Ver lista", barra da origem do prazo). */
  const irParaLista = (filtro: FiltroDaLista) => {
    mudar({ filtro });
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

  const colunasDoRanking: ColunaTabela<LinhaDoRanking>[] = [
    {
      chave: "nome",
      titulo: "Parceiro",
      celula: (p) => (
        <span className="flex flex-col">
          <span className="font-semibold text-foreground">{p.nome}</span>
          {p.usaSsw && <span className="text-xs text-muted-foreground">usa SSW</span>}
        </span>
      ),
    },
    { chave: "total", titulo: "CTRCs", formato: "inteiro" },
    {
      chave: "qtdParceiro",
      titulo: "Prazo do parceiro",
      alinhamento: "direita",
      celula: (p) => (
        <>
          {formatarInteiro(p.qtdParceiro)}{" "}
          <span className="text-muted-foreground">
            ({formatarPercentual(p.pctParceiro, { casas: 0 })})
          </span>
        </>
      ),
    },
    {
      chave: "nascidosAtrasados",
      titulo: "Nascidos em atraso",
      alinhamento: "direita",
      celula: (p) => (
        <span className={cn(p.pctNascidos > 0.1 && "font-semibold text-status-bad-fg")}>
          {formatarInteiro(p.nascidosAtrasados)}{" "}
          <span className="opacity-75">({formatarPercentual(p.pctNascidos, { casas: 0 })})</span>
        </span>
      ),
    },
    {
      chave: "performanceComParceiro",
      titulo: "Performance",
      alinhamento: "direita",
      celula: (p) => (
        <SeloStatus tom={SELO_DO_SLA[tomDoSla(p.performanceComParceiro, sla)]}>
          {formatarPercentual(p.performanceComParceiro)}
        </SeloStatus>
      ),
    },
    {
      chave: "abrir",
      titulo: "",
      ordenavel: false,
      alinhamento: "direita",
      celula: () => <ChevronRight className="inline h-4 w-4 text-muted-foreground" aria-hidden />,
    },
  ];

  const colunasDaLista = (
    [
      { chave: "numero", titulo: "CTRC", celula: (l) => <NumeroDoCtrc numero={l.numero} /> },
      {
        chave: "parceiroNome",
        titulo: "Parceiro",
        classe: "max-w-[180px] truncate",
        celula: (l) => l.parceiroNome ?? "—",
      },
      { chave: "dataEmbarque", titulo: "Embarque", celula: (l) => formatarData(l.dataEmbarque) },
      {
        chave: "dataPrevista",
        titulo: "Prazo entrega",
        celula: (l) => formatarData(l.dataPrevista),
      },
      {
        chave: "prazoPadraoData",
        titulo: "Mínimo 48h",
        classe: "text-muted-foreground",
        celula: (l) => formatarData(l.prazoPadraoData),
      },
      {
        chave: "diasAbaixoDoPadrao",
        titulo: "Abaixo do padrão (dias)",
        alinhamento: "direita",
        classe: "whitespace-nowrap",
        celula: (l) => (
          <span className={cn(l.nasceuAtrasado && "font-semibold text-status-bad-fg")}>
            {l.diasAbaixoDoPadrao ?? "—"}
          </span>
        ),
      },
      {
        chave: "origem",
        titulo: "Origem",
        celula: (l) => <EtiquetaDeOrigem origem={l.prazoOrigem} />,
      },
      {
        chave: "statusAtual",
        titulo: "Status",
        classe: "max-w-[160px] truncate text-muted-foreground",
        celula: (l) => l.statusAtual ?? "—",
      },
      { chave: "setor", titulo: "Setor", classe: "font-mono", celula: (l) => l.setor ?? "—" },
      {
        chave: "unidadeNome",
        titulo: "Unidade",
        classe: "max-w-[160px] truncate",
        celula: (l) => l.unidadeNome ?? "—",
      },
    ] satisfies ColunaTabela<LinhaPrazo>[]
  ).map((c): ColunaTabela<LinhaPrazo> => ({ ...c, ordenavel: false }));

  return (
    <Pagina
      titulo="Prazo próprio × Prazo do parceiro"
      descricao="Entenda quanto do seu atraso veio de fora"
      meta={<SeloDosDados mostrarXml className="" />}
      acoes={
        <Button
          size="sm"
          variant="ghost"
          disabled={atualizando}
          onClick={() => void queryClient.invalidateQueries({ queryKey: CHAVE_DO_PRAZO })}
        >
          <RefreshCw className={cn(atualizando && "animate-spin")} aria-hidden /> Atualizar
        </Button>
      }
      filtros={
        <>
          <FiltrosAvancados
            ativos={b.unidades.length > 0 || b.parceiros.length > 0 || b.tipos.length > 0}
            aoLimpar={() => {
              mudar({ unidades: [], parceiros: [], tipos: [] });
            }}
          >
            <AlternadorDePeriodo
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
            <span className="ml-auto text-[12.5px] text-muted-foreground">
              {ROTULO_PERIODO[b.periodo]}
            </span>
          </FiltrosAvancados>
          <FiltrandoPor etiquetas={etiquetas} />
        </>
      }
    >
      {visao.isError && (
        <Aviso
          tom="erro"
          acao={
            <Button size="sm" variant="outline" onClick={() => void visao.refetch()}>
              <RefreshCw aria-hidden /> Tentar novamente
            </Button>
          }
        >
          {mensagemAmigavel(visao.error)}
        </Aviso>
      )}
      {bannerPositivo && (
        <Aviso tom="sucesso" icone={TrendingUp}>
          Sua performance real é <strong>{formatarPontos(t.diferencaPp)}</strong> melhor do que
          aparece. <strong>{formatarInteiro(t.nascidosAtrasados)}</strong> CTRC(s) foram emitidos a
          menos de 48 horas da previsão de entrega neste período.
        </Aviso>
      )}
      {parceiroProblema && (
        <Aviso tom="alerta">
          Atenção: o parceiro <strong>{parceiroProblema.nome}</strong> está enviando muitas cargas
          com menos de 48 horas de prazo (
          <strong>{formatarPercentual(parceiroProblema.pctNascidos, { casas: 0 })}</strong> neste
          período). Vale uma conversa comercial.
        </Aviso>
      )}
      {bannerVariacao && a.deltaGapPp !== null && (
        <Aviso tom="info" icone={a.deltaGapPp > 0 ? TrendingUp : TrendingDown}>
          O impacto de prazos herdados {a.deltaGapPp > 0 ? "aumentou" : "diminuiu"}{" "}
          <strong>{formatarPontos(Math.abs(a.deltaGapPp))}</strong> em relação ao período anterior.
        </Aviso>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          rotulo="Performance total"
          valor={t ? formatarPercentual(t.performanceTotal) : "—"}
          status={t ? tomDoSla(t.performanceTotal, sla) : "bom"}
          neutro={!t}
          icone={Gauge}
          detalhe="como o SSW mostra · considerando todos os CTRCs"
        />
        <KpiCard
          rotulo="Performance própria"
          valor={t ? formatarPercentual(t.performancePropria) : "—"}
          status={t ? tomDoSla(t.performancePropria, sla) : "bom"}
          neutro={!t}
          icone={ShieldCheck}
          detalhe="responsabilidade real · apenas CTRCs com prazo próprio"
        />
        <KpiCard
          rotulo="Diferença"
          valor={t ? formatarPontos(t.diferencaPp) : "—"}
          status="bom"
          neutro={!(t && t.diferencaPp > 0)}
          icone={Scale}
          detalhe="atribuído a parceiros · o quanto sua performance está sendo puxada para baixo por prazos herdados"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Painel
          titulo="Origem do prazo"
          descricao="Distribuição dos CTRCs no período"
          icone={ChartPie}
          classeDoCorpo="px-5 py-4"
          rodape={
            t &&
            t.totalCtes > 0 && (
              <span>
                {formatarInteiro(t.totalParceiro)} CTRC(s) usaram o prazo importado do parceiro
                neste período.
              </span>
            )
          }
        >
          {visao.isLoading ? (
            <Skeleton className="h-20 rounded-lg bg-muted" />
          ) : t && t.totalCtes > 0 ? (
            <OrigemDoPrazo
              totais={t}
              aoVerParceiro={() => {
                irParaLista("prazo_parceiro");
              }}
            />
          ) : (
            <EstadoVazio className="py-6" mensagem="Sem CTRCs no período filtrado." />
          )}
        </Painel>

        <Painel
          titulo={
            <span className="inline-flex items-center gap-1.5">
              Nascidos em atraso
              <InfoTip
                texto={`CTRCs emitidos a menos de 48 horas (corridas) da previsão de entrega. A ${nomeCurto} não teria como cumprir: o atraso é do parceiro. CTRCs da TROCA ficam fora da conta. Só compara prazos — ocorrências, inclusive as de responsabilidade do cliente, não entram.`}
              />
            </span>
          }
          descricao="Emitido a menos de 48 horas da previsão de entrega"
          icone={Clock4}
          classeDoCorpo="px-5 py-4"
          rodape={
            <Button
              size="sm"
              variant="ghost"
              className="-ml-2 text-brand"
              onClick={() => {
                irParaLista("nascidos");
              }}
            >
              Ver lista <ArrowRight aria-hidden />
            </Button>
          }
        >
          {visao.isLoading ? (
            <Skeleton className="h-20 rounded-lg bg-muted" />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="num-hero text-foreground">
                  {formatarInteiro(t?.nascidosAtrasados ?? 0)}
                </span>
                {a && a.deltaNascidos !== 0 && (
                  <SeloStatus
                    tom={a.deltaNascidos > 0 ? "erro" : "sucesso"}
                    icone={a.deltaNascidos > 0 ? TrendingUp : TrendingDown}
                  >
                    {a.deltaNascidos > 0 ? `+${String(a.deltaNascidos)}` : a.deltaNascidos} vs
                    período anterior
                  </SeloStatus>
                )}
              </div>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                CTRC(s) no período
                {t?.pctNascidos != null && (
                  <> · {formatarPercentual(t.pctNascidos, { casas: 0 })} dos CTRCs avaliados</>
                )}
              </p>
            </>
          )}
        </Painel>
      </div>

      <TabelaDados
        titulo="Parceiros com mais prazos inviáveis no período"
        colunas={colunasDoRanking}
        linhas={ranking.slice(0, 10)}
        chaveDaLinha={(p) => p.id}
        aoClicarLinha={(p) =>
          void navigate({
            to: "/prazo-parceiro/$id",
            params: { id: p.id },
            search: { periodo: b.periodo, unidades: b.unidades, tipos: b.tipos },
          })
        }
        carregando={visao.isLoading}
        erro={visao.error}
        aoTentarDeNovo={() => void visao.refetch()}
        mensagemVazia="Sem dados no período."
        porPagina={0}
        rotuloTotal={() => "Top 10 — clique para abrir o detalhe do parceiro"}
      />

      <div id="lista-ctrcs" className="scroll-mt-36">
        <TabelaDados
          colunas={colunasDaLista}
          linhas={lista.data?.linhas ?? []}
          chaveDaLinha={(l) => l.id}
          aoClicarLinha={(l) => {
            abrirCte(l.numero);
          }}
          carregando={lista.isLoading}
          erro={lista.error}
          aoTentarDeNovo={() => void lista.refetch()}
          mensagemVazia="Não há CTRCs com prazo do parceiro no período filtrado. Tente ampliar o período."
          paginacaoServidor={{
            pagina: b.page,
            porPagina: b.size,
            total: lista.data?.total ?? 0,
            aoMudarPagina: (page) => {
              definir({ page });
            },
          }}
          rotuloTotal={(n) => `${formatarInteiro(n)} CTRC(s)`}
          acoes={
            <>
              <Alternador
                rotulo="Filtro da lista"
                tamanho="pequeno"
                opcoes={FILTROS_DA_LISTA.map((f) => ({ valor: f, rotulo: ROTULO_FILTRO[f] }))}
                valor={b.filtro}
                aoMudar={(filtro) => {
                  mudar({ filtro });
                }}
              />
              <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                  <span>Linhas por página:</span>
                  <Select
                    value={String(b.size)}
                    onValueChange={(v) => {
                      mudar({ size: tamanhoDaLista(Number(v)) });
                    }}
                  >
                    <SelectTrigger
                      aria-label="Linhas por página"
                      className="h-8 w-[76px] text-[13px] font-medium text-foreground"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TAMANHOS_DA_LISTA.map((s) => (
                        <SelectItem key={s} value={String(s)} className="text-[13px]">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <ExportMenu
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
            </>
          }
        />
      </div>
    </Pagina>
  );
}

/**
 * Barra 100% empilhada da origem do prazo (2 partes): dica no passar do mouse e no foco; a parte
 * do parceiro filtra a lista abaixo.
 */
function OrigemDoPrazo({
  totais: t,
  aoVerParceiro,
}: {
  totais: TotaisDoPrazo;
  aoVerParceiro: () => void;
}) {
  const partes = [
    {
      chave: "proprio" as const,
      rotulo: "Prazo próprio",
      qtd: t.totalProprio,
      pct: t.pctPrazoProprio,
    },
    {
      chave: "parceiro" as const,
      rotulo: "Prazo do parceiro",
      qtd: t.totalParceiro,
      pct: t.pctPrazoParceiro,
    },
  ];
  const dica = (p: (typeof partes)[number]) =>
    `${p.rotulo}: ${formatarInteiro(p.qtd)} (${formatarPercentual(p.pct, { casas: 0 })})`;
  return (
    <TooltipProvider delayDuration={80}>
      <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
        {partes.map((p) => {
          const estilo = { width: `${String(p.pct * 100)}%`, background: COR_DA_ORIGEM[p.chave] };
          const classe =
            "h-full min-w-1 transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
          return (
            <Tooltip key={p.chave}>
              <TooltipTrigger asChild>
                {p.chave === "parceiro" ? (
                  <button
                    type="button"
                    aria-label={dica(p)}
                    onClick={aoVerParceiro}
                    className={cn(classe, "cursor-pointer")}
                    style={estilo}
                  />
                ) : (
                  <span
                    role="img"
                    tabIndex={0}
                    aria-label={dica(p)}
                    className={classe}
                    style={estilo}
                  />
                )}
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[12px]">
                {dica(p)}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        {partes.map((p) => (
          <div key={p.chave}>
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-[3px]"
                style={{ background: COR_DA_ORIGEM[p.chave] }}
              />
              {p.rotulo}
            </div>
            <div className="mt-1 text-[18px] font-bold text-foreground tabular-nums">
              {formatarInteiro(p.qtd)}{" "}
              <span className="text-[12.5px] font-medium text-muted-foreground">
                ({formatarPercentual(p.pct, { casas: 0 })})
              </span>
            </div>
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
