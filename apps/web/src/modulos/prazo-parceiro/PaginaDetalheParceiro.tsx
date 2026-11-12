/**
 * Detalhe do parceiro (`/prazo-parceiro/$id`): performance, atraso na origem e os CT-e
 * nascidos em atraso. origem: routes/_authenticated/prazo-parceiro.$id.tsx (sistema atual)
 */
import { hojeNoFuso } from "@erp/shared/datas";
import { formatarInteiro, formatarPercentual, formatarPontos } from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowLeft, ChartBarBig, Gauge, RefreshCw, Scale, ShieldCheck } from "lucide-react";

import { Aviso } from "@/componentes/comum/Aviso";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";
import {
  type EtiquetaFiltroOpcional,
  FiltrandoPor,
  FiltrosAvancados,
  resumirNomes,
} from "@/componentes/comum/FiltrosAvancados";
import { KpiCard } from "@/componentes/comum/KpiCard";
import { Painel } from "@/componentes/comum/Painel";
import { resolverPeriodo } from "@/componentes/comum/periodo";
import { Pagina } from "@/componentes/layout/Pagina";
import { SeloDosDados } from "@/componentes/layout/SeloDosDados";
import { Button } from "@/componentes/ui/button";
import { Skeleton } from "@/componentes/ui/skeleton";
import { useAbrirCte } from "@/hooks/use-abrir-cte";
import { useFiltrosNaUrl } from "@/hooks/use-filtros-na-url";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";

import { consultaDetalhe, consultaOpcoes } from "./api";
import { esquemaDetalhe, filtrosDaBusca } from "./busca";
import { AlternadorDePeriodo } from "./componentes/AlternadorDePeriodo";
import { GraficoAtrasoNaOrigem } from "./componentes/GraficoAtrasoNaOrigem";
import { TabelaNascidosEmAtraso } from "./componentes/TabelaNascidosEmAtraso";
import { tomDoSla } from "./regras";
import { opcoesDeTipo, ROTULO_PERIODO, rotuloDoTipo } from "./textos";

const rota = getRouteApi("/_autenticado/prazo-parceiro_/$id");

export function PaginaDetalheParceiro() {
  const { id } = rota.useParams();
  const fuso = useFusoDaEmpresa();
  const { filtros: b, definir } = useFiltrosNaUrl(esquemaDetalhe);
  const abrirCte = useAbrirCte();
  const intervalo = resolverPeriodo(b.periodo, "", "", hojeNoFuso(fuso));
  const q = useQuery(consultaDetalhe(id, filtrosDaBusca(b, intervalo)));
  const opcoes = useQuery(consultaOpcoes(intervalo)).data;
  const d = q.data;
  const r = d?.resumo;
  const sla = d?.sla ?? { meta: 0.95, alerta: 0.9 };
  const diferenca = r ? r.performancePropria - r.performanceTotal : 0;
  const nascidos = d?.nascidos ?? [];

  const nomesDasUnidades = b.unidades.flatMap(
    (u) => opcoes?.unidades.find((o) => o.id === u)?.nome ?? [],
  );
  const etiquetas: EtiquetaFiltroOpcional[] = [
    b.unidades.length > 0 && {
      rotulo: "Unidades",
      ...(nomesDasUnidades.length === b.unidades.length
        ? resumirNomes(nomesDasUnidades)
        : {
            valor: b.unidades.length === 1 ? "1 selecionada" : `${b.unidades.length} selecionadas`,
          }),
      limpar: () => {
        definir({ unidades: [] });
      },
    },
    b.tipos.length > 0 && {
      rotulo: "Tipo documento",
      ...resumirNomes(b.tipos.map(rotuloDoTipo)),
      limpar: () => {
        definir({ tipos: [] });
      },
    },
  ];

  return (
    <Pagina
      titulo={d?.parceiro.nome ?? "Parceiro"}
      descricao={
        <>
          Detalhe de prazo do parceiro · {ROTULO_PERIODO[b.periodo]}
          {d?.parceiro.prazoAcordoHoras != null && (
            <span className="ml-2">· acordo: {d.parceiro.prazoAcordoHoras}h</span>
          )}
        </>
      }
      meta={<SeloDosDados className="" />}
      acoes={
        <>
          <Button asChild size="sm" variant="ghost">
            <Link
              to="/prazo-parceiro"
              search={{ periodo: b.periodo, unidades: b.unidades, tipos: b.tipos }}
            >
              <ArrowLeft aria-hidden /> Voltar
            </Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={q.isFetching}
            onClick={() => void q.refetch()}
          >
            <RefreshCw className={cn(q.isFetching && "animate-spin")} aria-hidden /> Atualizar
          </Button>
        </>
      }
      filtros={
        <>
          <FiltrosAvancados
            ativos={b.unidades.length > 0 || b.tipos.length > 0}
            aoLimpar={() => {
              definir({ unidades: [], tipos: [] });
            }}
          >
            <AlternadorDePeriodo
              atual={b.periodo}
              aoMudar={(periodo) => {
                definir({ periodo });
              }}
            />
            <FiltroMultiplo
              rotulo="Tipo documento"
              opcoes={opcoes && opcoesDeTipo(opcoes.tipos)}
              selecionados={b.tipos}
              aoMudar={(tipos) => {
                definir({ tipos });
              }}
              textoVazio="todos"
            />
          </FiltrosAvancados>
          <FiltrandoPor etiquetas={etiquetas} />
        </>
      }
    >
      {q.isError && (
        <Aviso
          tom="erro"
          acao={
            <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
              <RefreshCw aria-hidden /> Tentar novamente
            </Button>
          }
        >
          {mensagemAmigavel(q.error)}
        </Aviso>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          rotulo="Performance total"
          valor={r ? formatarPercentual(r.performanceTotal) : "—"}
          status={r ? tomDoSla(r.performanceTotal, sla) : "bom"}
          neutro={!r}
          icone={Gauge}
          detalhe={`${formatarInteiro(r?.totalCtes ?? 0)} CTRC(s) no período`}
        />
        <KpiCard
          rotulo="Performance própria"
          valor={r ? formatarPercentual(r.performancePropria) : "—"}
          status={r ? tomDoSla(r.performancePropria, sla) : "bom"}
          neutro={!r}
          icone={ShieldCheck}
          detalhe={`apenas ${formatarInteiro(r?.totalProprio ?? 0)} CTRC(s) com prazo próprio`}
        />
        <KpiCard
          rotulo="Diferença"
          valor={formatarPontos(diferenca)}
          status="bom"
          neutro={!(diferenca > 0)}
          icone={Scale}
          detalhe={`${formatarInteiro(r?.nascidosAtrasados ?? 0)} CTRC(s) nasceram em atraso`}
        />
      </div>

      <Painel
        titulo="Atraso na origem"
        descricao="Quantos dias o prazo do CT-e veio abaixo das 48 horas, por faixa"
        icone={ChartBarBig}
        classeDoCorpo="px-5 py-4"
      >
        {q.isLoading ? (
          <Skeleton className="h-24 rounded-lg bg-muted" />
        ) : (d?.histograma.length ?? 0) === 0 ? (
          <EstadoVazio className="py-6" mensagem="Nenhum CTRC nasceu atrasado neste período." />
        ) : (
          <GraficoAtrasoNaOrigem faixas={d?.histograma ?? []} />
        )}
      </Painel>

      <TabelaNascidosEmAtraso
        nascidos={nascidos}
        nomeDoParceiro={d?.parceiro.nome}
        periodo={b.periodo}
        carregando={q.isLoading}
        aoAbrir={(n) => {
          abrirCte(n.numero);
        }}
      />
    </Pagina>
  );
}
