/**
 * Detalhe do parceiro (`/prazo-parceiro/$id`): performance, atraso na origem e os CT-e
 * nascidos em atraso. origem: routes/_authenticated/prazo-parceiro.$id.tsx (sistema atual)
 */
import { type NascidoAtrasado } from "@erp/shared/contratos/prazo-parceiro";
import { hojeNoFuso } from "@erp/shared/datas";
import {
  formatarData,
  formatarInteiro,
  formatarPercentual,
  formatarPontos,
} from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowLeft, ChartBarBig, Gauge, RefreshCw, Scale, ShieldCheck } from "lucide-react";

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
import { KpiCard } from "@/componentes/comum/KpiCard";
import { Painel } from "@/componentes/comum/Painel";
import { resolverPeriodo } from "@/componentes/comum/periodo";
import { type ColunaTabela } from "@/componentes/comum/tabela-dados";
import { TabelaDados } from "@/componentes/comum/TabelaDados";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { Skeleton } from "@/componentes/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/componentes/ui/tooltip";
import { useAbrirCte } from "@/hooks/use-abrir-cte";
import { useFiltrosNaUrl } from "@/hooks/use-filtros-na-url";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { COLUNA_LINK_SSW, type ColunaExportacao, urlCtrcNoSsw } from "@/lib/exportacao";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";
import { SeloDosDados } from "@/modulos/ingestao-ssw/SeloDosDados";

import { consultaDetalhe, consultaOpcoes } from "./api";
import { esquemaDetalhe, filtrosDaBusca, ROTULO_PERIODO } from "./busca";
import { AlternadorDePeriodo, NumeroDoCtrc } from "./pecas";
import { tomDoSla } from "./sla";
import { opcoesDeTipo, rotuloDoTipo } from "./tipos";

const rota = getRouteApi("/_autenticado/prazo-parceiro_/$id");

const COLUNAS_DA_EXPORTACAO: readonly ColunaExportacao[] = [
  { chave: "numero", titulo: "CTRC" },
  { chave: "dataEmbarque", titulo: "Embarque", formato: "data" },
  { chave: "dataPrevista", titulo: "Prazo entrega", formato: "data" },
  { chave: "prazoPadraoData", titulo: "Mínimo 48h", formato: "data" },
  { chave: "diasAbaixoDoPadrao", titulo: "Abaixo das 48h (dias)", formato: "inteiro" },
  { chave: "statusAtual", titulo: "Status" },
  { chave: "setor", titulo: "Setor" },
  { chave: "destino", titulo: "Destino" },
  { chave: "unidadeNome", titulo: "Unidade" },
  { chave: "linkSsw", titulo: COLUNA_LINK_SSW },
];

const destinoDe = (n: NascidoAtrasado) =>
  n.cidadeDestino ? `${n.cidadeDestino}${n.ufDestino ? `/${n.ufDestino}` : ""}` : null;

/** Nome do arquivo sem acento nem espaço ("prazo-parceiro-transportes-abc"). */
const slug = (nome: string) =>
  nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

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

  const colunas = (
    [
      { chave: "numero", titulo: "CTRC", celula: (n) => <NumeroDoCtrc numero={n.numero} /> },
      { chave: "dataEmbarque", titulo: "Embarque", celula: (n) => formatarData(n.dataEmbarque) },
      {
        chave: "dataPrevista",
        titulo: "Prazo entrega",
        celula: (n) => formatarData(n.dataPrevista),
      },
      {
        chave: "prazoPadraoData",
        titulo: "Mínimo 48h",
        classe: "text-muted-foreground",
        celula: (n) => formatarData(n.prazoPadraoData),
      },
      {
        chave: "diasAbaixoDoPadrao",
        titulo: "Abaixo das 48h (dias)",
        alinhamento: "direita",
        classe: "whitespace-nowrap font-semibold text-status-bad-fg",
        celula: (n) => n.diasAbaixoDoPadrao ?? "—",
      },
      {
        chave: "statusAtual",
        titulo: "Status",
        classe: "max-w-[160px] truncate text-muted-foreground",
        celula: (n) => n.statusAtual ?? "—",
      },
      { chave: "setor", titulo: "Setor", classe: "font-mono", celula: (n) => n.setor ?? "—" },
      { chave: "destino", titulo: "Destino", celula: (n) => destinoDe(n) ?? "—" },
      {
        chave: "unidadeNome",
        titulo: "Unidade",
        classe: "max-w-[160px] truncate",
        celula: (n) => n.unidadeNome ?? "—",
      },
    ] satisfies ColunaTabela<NascidoAtrasado>[]
  ).map((c): ColunaTabela<NascidoAtrasado> => ({ ...c, ordenavel: false }));

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
          <Histograma faixas={d?.histograma ?? []} />
        )}
      </Painel>

      <TabelaDados
        titulo="CTRCs nascidos em atraso"
        colunas={colunas}
        linhas={nascidos}
        chaveDaLinha={(n) => n.id}
        aoClicarLinha={(n) => {
          abrirCte(n.numero);
        }}
        carregando={q.isLoading}
        mensagemVazia="Nenhum CTRC nasceu atrasado deste parceiro no período."
        porPagina={0}
        rotuloTotal={(n) =>
          `${formatarInteiro(n)} CTRC(s) · Use esta lista na reunião comercial com o parceiro`
        }
        acoes={
          <div className="flex flex-1 justify-end">
            <ExportMenu
              arquivo={`prazo-parceiro-${slug(d?.parceiro.nome ?? "parceiro")}`}
              titulo={`Nascidos em atraso — ${d?.parceiro.nome ?? "parceiro"}`}
              subtitulo={ROTULO_PERIODO[b.periodo]}
              colunas={COLUNAS_DA_EXPORTACAO}
              linhas={nascidos.map((n) => ({
                ...n,
                destino: destinoDe(n),
                linkSsw: urlCtrcNoSsw(n.sigla, n.numero, n.dataEmissao),
              }))}
              formatos={["csv", "excel"]}
              desabilitado={q.isLoading || nascidos.length === 0}
            />
          </div>
        }
      />
    </Pagina>
  );
}

/** Barras horizontais por faixa de atraso, com dica no passar do mouse e no foco do teclado. */
function Histograma({ faixas }: { faixas: readonly { faixa: string; qtd: number }[] }) {
  const maior = Math.max(1, ...faixas.map((h) => h.qtd));
  return (
    <TooltipProvider delayDuration={80}>
      <ul className="space-y-2.5">
        {faixas.map((h) => {
          const texto = `${h.faixa}: ${formatarInteiro(h.qtd)} CTRC(s)`;
          return (
            <li key={h.faixa} className="flex items-center gap-3 text-[13px]">
              <span className="w-24 shrink-0 text-muted-foreground">{h.faixa}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    role="img"
                    tabIndex={0}
                    aria-label={texto}
                    className="group h-3.5 flex-1 rounded-full bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span
                      className="block h-full rounded-full bg-status-bad transition-opacity group-hover:opacity-80"
                      style={{ width: `${String((h.qtd / maior) * 100)}%` }}
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[12px]">
                  {texto}
                </TooltipContent>
              </Tooltip>
              <span className="w-12 shrink-0 text-right font-semibold tabular-nums">
                {formatarInteiro(h.qtd)}
              </span>
            </li>
          );
        })}
      </ul>
    </TooltipProvider>
  );
}
