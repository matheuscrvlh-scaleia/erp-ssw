/**
 * Detalhe do parceiro (`/prazo-parceiro/$id`): performance, atraso na origem e os CT-e
 * nascidos em atraso. origem: routes/_authenticated/prazo-parceiro.$id.tsx (sistema atual)
 */
import { type NascidoAtrasado } from "@erp/shared/contratos/prazo-parceiro";
import { hojeNoFuso } from "@erp/shared/datas";
import { formatarData, formatarPercentual } from "@erp/shared/formatacao";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { consultaAcesso } from "@/acesso/sessao";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";
import {
  type EtiquetaFiltroOpcional,
  FiltrandoPor,
  resumirNomes,
} from "@/componentes/comum/FiltrosAvancados";
import { resolverPeriodo } from "@/componentes/comum/periodo";
import { Button } from "@/componentes/ui/button";
import { useAbrirCte } from "@/hooks/use-abrir-cte";
import { useFiltrosNaUrl } from "@/hooks/use-filtros-na-url";
import { COLUNA_LINK_SSW, type ColunaExportacao, urlCtrcNoSsw } from "@/lib/exportacao";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";
import { SeloDosDados } from "@/modulos/ingestao-ssw/SeloDosDados";

import { consultaDetalhe, consultaOpcoes } from "./api";
import { esquemaDetalhe, filtrosDaBusca, ROTULO_PERIODO } from "./busca";
import {
  BotoesDePeriodo,
  CartaoMetrica,
  fmtPP,
  LinhasCarregando,
  nfInt,
  tomDoSla,
} from "./componentes";
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
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const { filtros: b, definir } = useFiltrosNaUrl(esquemaDetalhe);
  const abrirCte = useAbrirCte();
  const intervalo = resolverPeriodo(
    b.periodo,
    "",
    "",
    hojeNoFuso(acesso.empresa?.fuso ?? "America/Sao_Paulo"),
  );
  const q = useQuery(consultaDetalhe(id, filtrosDaBusca(b, intervalo)));
  const opcoes = useQuery(consultaOpcoes(intervalo)).data;
  const d = q.data;
  const r = d?.resumo;
  const sla = d?.sla ?? { meta: 0.95, alerta: 0.9 };
  const maiorFaixa = Math.max(1, ...(d?.histograma.map((h) => h.qtd) ?? []));
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
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            to="/prazo-parceiro"
            search={{ periodo: b.periodo, unidades: b.unidades, tipos: b.tipos }}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> voltar
          </Link>
          <h1 className="text-[24px] font-medium tracking-tight">
            {d?.parceiro.nome ?? "Parceiro"}
          </h1>
          <SeloDosDados />
          <p className="text-[12px] text-muted-foreground">
            Detalhe de prazo do parceiro · {ROTULO_PERIODO[b.periodo]}
            {d?.parceiro.prazoAcordoHoras != null && (
              <span className="ml-2">· acordo: {d.parceiro.prazoAcordoHoras}h</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BotoesDePeriodo
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
          <Button
            size="sm"
            variant="ghost"
            disabled={q.isFetching}
            onClick={() => void q.refetch()}
          >
            <RefreshCw className={cn("mr-1.5 h-3 w-3", q.isFetching && "animate-spin")} /> Atualizar
          </Button>
        </div>
      </header>

      <FiltrandoPor etiquetas={etiquetas} />

      {q.isError && (
        <p className="rounded-[10px] border border-[var(--status-bad)]/40 bg-[var(--status-bad-bg)] px-3 py-2 text-[12px] text-[var(--status-bad-fg)]">
          {mensagemAmigavel(q.error)}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <CartaoMetrica
          tamanho="medio"
          rotulo="Performance total"
          valor={r ? formatarPercentual(r.performanceTotal) : "—"}
          tom={r && tomDoSla(r.performanceTotal, sla)}
          dica={`${nfInt.format(r?.totalCtes ?? 0)} CTRC(s) no período`}
          carregando={q.isLoading}
        />
        <CartaoMetrica
          tamanho="medio"
          rotulo="Performance própria"
          valor={r ? formatarPercentual(r.performancePropria) : "—"}
          tom={r && tomDoSla(r.performancePropria, sla)}
          dica={`apenas ${nfInt.format(r?.totalProprio ?? 0)} CTRC(s) com prazo próprio`}
          carregando={q.isLoading}
          destaque
        />
        <CartaoMetrica
          tamanho="medio"
          rotulo="Diferença"
          valor={fmtPP(diferenca)}
          tom={diferenca > 0 ? "bom" : "neutro"}
          dica={`${nfInt.format(r?.nascidosAtrasados ?? 0)} CTRC(s) nasceram em atraso`}
          carregando={q.isLoading}
        />
      </div>

      <div className="rounded-[10px] border border-border/70 bg-card p-3">
        <h2 className="text-[14px] font-medium">Atraso na origem</h2>
        <p className="text-[11px] text-muted-foreground">
          Quantos dias o prazo do CT-e veio abaixo das 48 horas, por faixa
        </p>
        {q.isLoading ? (
          <div className="mt-4 h-24 animate-pulse rounded bg-muted/60" />
        ) : (d?.histograma.length ?? 0) === 0 ? (
          <p className="mt-4 text-[12px] text-muted-foreground">
            Nenhum CTRC nasceu atrasado neste período.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {d?.histograma.map((h) => (
              <li key={h.faixa} className="flex items-center gap-2 text-[12px]">
                <span className="w-20 text-muted-foreground">{h.faixa}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-[var(--status-bad)]"
                    style={{ width: `${(h.qtd / maiorFaixa) * 100}%` }}
                  />
                </div>
                <span className="w-10 text-right tabular-nums">{nfInt.format(h.qtd)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-[10px] border border-border/70 bg-card">
        <div className="flex items-center justify-between border-b border-border/70 p-3">
          <div>
            <h2 className="text-[14px] font-medium">CTRCs nascidos em atraso</h2>
            <p className="text-[11px] text-muted-foreground">
              Use esta lista na reunião comercial com o parceiro
            </p>
          </div>
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
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="border-b border-border/70">
                <th className="px-3 py-1.5 text-left font-normal">CTRC</th>
                <th className="px-3 py-1.5 text-left font-normal">Embarque</th>
                <th className="px-3 py-1.5 text-left font-normal">Prazo entrega</th>
                <th className="px-3 py-1.5 text-left font-normal">Mínimo 48h</th>
                <th className="px-3 py-1.5 text-right font-normal">Abaixo das 48h (dias)</th>
                <th className="px-3 py-1.5 text-left font-normal">Status</th>
                <th className="px-3 py-1.5 text-left font-normal">Setor</th>
                <th className="px-3 py-1.5 text-left font-normal">Destino</th>
                <th className="px-3 py-1.5 text-left font-normal">Unidade</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && <LinhasCarregando linhas={6} colunas={9} />}
              {q.isSuccess && nascidos.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                    Nenhum CTRC nasceu atrasado deste parceiro no período.
                  </td>
                </tr>
              )}
              {nascidos.map((n) => (
                <tr
                  key={n.id}
                  onClick={() => {
                    abrirCte(n.numero);
                  }}
                  className="cursor-pointer border-b border-border/40 last:border-0 hover:bg-muted/40"
                >
                  <td className="px-3 py-1.5 font-mono text-[11px] text-[var(--brand)]">
                    {n.numero}
                  </td>
                  <td className="px-3 py-1.5">{formatarData(n.dataEmbarque)}</td>
                  <td className="px-3 py-1.5">{formatarData(n.dataPrevista)}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {formatarData(n.prazoPadraoData)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums text-[var(--status-bad)]">
                    {n.diasAbaixoDoPadrao ?? "—"}
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-1.5 text-muted-foreground">
                    {n.statusAtual ?? "—"}
                  </td>
                  <td className="px-3 py-1.5 font-mono">{n.setor ?? "—"}</td>
                  <td className="px-3 py-1.5">{destinoDe(n) ?? "—"}</td>
                  <td className="max-w-[140px] truncate px-3 py-1.5">{n.unidadeNome ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
