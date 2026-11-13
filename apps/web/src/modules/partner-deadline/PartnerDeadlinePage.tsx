/**
 * Prazo próprio × Prazo do parceiro (`/prazo-parceiro`): cards, origem do prazo, nascidos em
 * atraso, ranking de parceiros e lista de CT-e. origem: routes/_authenticated/prazo-parceiro.tsx
 */
import { type FiltroDaLista } from "@erp/shared/contracts/partner-deadline";
import { hojeNoFuso } from "@erp/shared/dates";
import { formatarInteiro, formatarPercentual, formatarPontos } from "@erp/shared/formatting";
import { useIsFetching, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ChartPie,
  Gauge,
  RefreshCw,
  Scale,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { consultaAcesso } from "@/access/session";
import { EstadoVazio } from "@/components/common/EmptyState";
import { KpiCard } from "@/components/common/KpiCard";
import { Aviso } from "@/components/common/Notice";
import { Painel } from "@/components/common/Panel";
import { resolverPeriodo } from "@/components/common/period";
import { SeloDosDados } from "@/components/layout/DataBadge";
import { Pagina } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFusoDaEmpresa } from "@/hooks/use-company-timezone";
import { useAbrirCte } from "@/hooks/use-open-cte";
import { useFiltrosNaUrl } from "@/hooks/use-url-filters";
import { mensagemAmigavel } from "@/lib/error-message";
import { cn } from "@/lib/utils";

import { chaves, consultaLista, consultaOpcoes, consultaVisaoGeral, exportarLista } from "./api";
import { PainelNascidosEmAtraso } from "./components/BornLatePanel";
import { TabelaListaDoPrazo } from "./components/DeadlineListTable";
import { GraficoOrigemDoPrazo } from "./components/DeadlineOriginChart";
import { FiltrosPrazoParceiro } from "./components/PartnerDeadlineFilters";
import { TabelaRankingDeParceiros } from "./components/PartnerRankingTable";
import { linhaDaLista } from "./export";
import { tomDoSla } from "./rules";
import { type BuscaPrazo, esquemaPrazo, filtrosDaBusca, tamanhoDaLista } from "./search";

export function PaginaPrazoParceiro() {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const fuso = useFusoDaEmpresa();
  const nomeCurto = acesso.empresa?.nomeCurto ?? "transportadora";
  const { filtros: b, definir } = useFiltrosNaUrl(esquemaPrazo);
  const navigate = useNavigate();
  const abrirCte = useAbrirCte();
  const queryClient = useQueryClient();
  const atualizando = useIsFetching({ queryKey: chaves.tudo }) > 0;

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
  const mudar = (m: Partial<BuscaPrazo>) => {
    definir({ ...m, page: 1 });
  };

  const bannerPositivo = t && t.diferencaPp > 0.03;
  const bannerVariacao = a?.deltaGapPp != null && Math.abs(a.deltaGapPp) > 0.05;
  const parceiroProblema = ranking.find((p) => p.pctNascidos > 0.3 && p.nascidosAtrasados >= 3);

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
    return r.linhas.map(linhaDaLista);
  };

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
          onClick={() => void queryClient.invalidateQueries({ queryKey: chaves.tudo })}
        >
          <RefreshCw className={cn(atualizando && "animate-spin")} aria-hidden /> Atualizar
        </Button>
      }
      filtros={<FiltrosPrazoParceiro busca={b} opcoes={opcoes} mudar={mudar} />}
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
            <GraficoOrigemDoPrazo
              totais={t}
              aoVerParceiro={() => {
                irParaLista("prazo_parceiro");
              }}
            />
          ) : (
            <EstadoVazio className="py-6" mensagem="Sem CTRCs no período filtrado." />
          )}
        </Painel>

        <PainelNascidosEmAtraso
          nomeCurto={nomeCurto}
          carregando={visao.isLoading}
          totais={t}
          comparacao={a}
          aoVerLista={() => {
            irParaLista("nascidos");
          }}
        />
      </div>

      <TabelaRankingDeParceiros
        ranking={ranking}
        sla={sla}
        carregando={visao.isLoading}
        erro={visao.error}
        aoTentarDeNovo={() => void visao.refetch()}
        aoAbrir={(p) =>
          void navigate({
            to: "/prazo-parceiro/$id",
            params: { id: p.id },
            search: { periodo: b.periodo, unidades: b.unidades, tipos: b.tipos },
          })
        }
      />

      <div id="lista-ctrcs" className="scroll-mt-36">
        <TabelaListaDoPrazo
          busca={b}
          linhas={lista.data?.linhas ?? []}
          total={lista.data?.total ?? 0}
          carregando={lista.isLoading}
          erro={lista.error}
          aoTentarDeNovo={() => void lista.refetch()}
          aoAbrir={(l) => {
            abrirCte(l.numero);
          }}
          mudar={mudar}
          aoMudarPagina={(page) => {
            definir({ page });
          }}
          carregarParaExportar={carregarParaExportar}
        />
      </div>
    </Pagina>
  );
}
