import { type Periodo, resolverPeriodo } from "@erp/dominio/performance/tela";
import {
  type FiltroPerformanceEntrada,
  type RelatorioPeriodo,
} from "@erp/shared/contratos/performance";
import { hojeNoFuso } from "@erp/shared/datas";
import { formatarInteiro, formatarMoeda, formatarPercentual } from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import {
  FileBarChart,
  FileSpreadsheet,
  FileText,
  GitCompareArrows,
  Info,
  Printer,
} from "lucide-react";
import { Fragment, useState } from "react";
import { toast } from "sonner";

import { Alternador } from "@/componentes/comum/Alternador";
import { Aviso } from "@/componentes/comum/Aviso";
import { FiltroPeriodo } from "@/componentes/comum/FiltroPeriodo";
import { useEmpresaDaExportacao } from "@/componentes/comum/use-empresa-da-exportacao";
import { SeloDosDados } from "@/componentes/layout/SeloDosDados";
import { Button } from "@/componentes/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/componentes/ui/dialog";
import { Switch } from "@/componentes/ui/switch";
import { exportarCsvEmSecoes, exportarExcel, imprimirDocumento } from "@/lib/exportacao";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";

import { consultaRelatorio } from "./api";
import { DistribuicaoPontualidade } from "./Kpis";
import {
  etiquetasDoRelatorio,
  excelDoRelatorio,
  type FiltrosDoRelatorio,
  type Indicador,
  indicadoresDoRelatorio,
} from "./relatorio";
import { csvDoRelatorio } from "./relatorio-csv";
import { impressaoDoRelatorio } from "./relatorio-impressao";

const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

interface FiltrosHerdados {
  entrada: Omit<FiltroPerformanceEntrada, "inicio" | "fim" | "baseData">;
  codigos: string[];
  /** Filtros por extenso: etiquetas, CSV, impressão e notas da aba "Resumo" do Excel. */
  filtros: FiltrosDoRelatorio;
}

/** Relatório de período: janela própria (padrão "Hoje"), comparativo opcional e exportação. */
export function DialogoRelatorio({
  aberto,
  onAberto,
  herdados,
  fuso,
  empresa,
}: {
  aberto: boolean;
  onAberto: (v: boolean) => void;
  herdados: FiltrosHerdados;
  fuso: string;
  empresa: string;
}) {
  const [preset, setPreset] = useState<Periodo>("hoje");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [comparativoAberto, setComparativoAberto] = useState(false);
  const [comparar, setComparar] = useState(false);
  const [cmpDe, setCmpDe] = useState("");
  const [cmpAte, setCmpAte] = useState("");
  const [modoPrevistos, setModoPrevistos] = useState<"todos" | "periodo">("todos");

  const { inicio, fim } = resolverPeriodo(preset, de, ate, hojeNoFuso(fuso));
  const comparativoAtivo = comparar && Boolean(cmpDe && cmpAte);
  const { data, isFetching, error } = useQuery({
    ...consultaRelatorio({
      ...herdados.entrada,
      inicio,
      fim,
      baseData: "emissao",
      ...(comparativoAtivo ? { comparativoInicio: cmpDe, comparativoFim: cmpAte } : {}),
    }),
    enabled: aberto,
  });

  const marca = useEmpresaDaExportacao();
  const etiquetas = etiquetasDoRelatorio(herdados.filtros);
  const falhou = (e: unknown) => {
    toast.error("Não foi possível gerar o arquivo", { description: mensagemAmigavel(e) });
  };

  return (
    <Dialog open={aberto} onOpenChange={onAberto}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden p-0">
        <DialogHeader className="space-y-1 border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[16px] font-bold">
            <FileBarChart className="h-[18px] w-[18px] text-brand" aria-hidden />
            Relatório de período
          </DialogTitle>
          <SeloDosDados mostrarXml className="text-xs" />
          <DialogDescription className="text-[12.5px]">
            Visão consolidada da operação no período selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-brand/40 bg-brand-suave px-4 py-2.5">
              <Info className="h-4 w-4 text-brand" aria-hidden />
              <span className="text-[12.5px] font-semibold text-brand">
                Período próprio do relatório
              </span>
              <span className="text-[12.5px] text-muted-foreground">
                não segue o período da barra principal
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <FiltroPeriodo
                  periodo={preset}
                  de={de}
                  ate={ate}
                  padrao="hoje"
                  aoMudar={(m) => {
                    setPreset(m.periodo === "mes_anterior" ? "mes" : m.periodo);
                    setDe(m.de);
                    setAte(m.ate);
                  }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card">
              <button
                type="button"
                onClick={() => {
                  setComparativoAberto((v) => !v);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold hover:bg-muted/60"
              >
                <span className="flex items-center gap-2">
                  <GitCompareArrows className="h-4 w-4 text-muted-foreground" aria-hidden />
                  Comparar com outro período
                  {comparativoAtivo && (
                    <span className="ml-1 rounded-md border border-border px-1.5 text-xs font-normal">
                      {dataBr(cmpDe)} → {dataBr(cmpAte)}
                    </span>
                  )}
                </span>
                <span className="text-[12.5px] font-normal text-muted-foreground">
                  {comparativoAberto ? "ocultar" : "mostrar"}
                </span>
              </button>
              {comparativoAberto && (
                <div className="flex flex-wrap items-center gap-3 border-t border-border px-3 py-2.5">
                  <label className="flex items-center gap-2 text-[13px]">
                    <Switch checked={comparar} onCheckedChange={setComparar} />
                    <span className={comparar ? "text-foreground" : "text-muted-foreground"}>
                      Ativar comparativo
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] text-muted-foreground">Período secundário:</span>
                    <FiltroPeriodo
                      periodo={cmpDe && cmpAte ? "custom" : "hoje"}
                      de={cmpDe}
                      ate={cmpAte}
                      atalhos={[]}
                      rotulo="Comparativo"
                      aoMudar={(m) => {
                        setCmpDe(m.de);
                        setCmpAte(m.ate);
                        if (m.de && m.ate) setComparar(true);
                      }}
                    />
                  </div>
                  {comparar && (!cmpDe || !cmpAte) && (
                    <span className="text-[12.5px] text-status-warn-fg">
                      Selecione as datas do período secundário.
                    </span>
                  )}
                </div>
              )}
            </div>

            {etiquetas.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[12.5px] text-muted-foreground">
                  Filtros herdados da barra principal:
                </span>
                {etiquetas.map((e) => (
                  <span
                    key={e.rotulo}
                    className="inline-flex h-6 items-center rounded-full border border-brand/40 bg-brand-suave px-2.5 text-xs"
                  >
                    <span className="text-muted-foreground">{e.rotulo}:</span>
                    <span className="ml-1 font-semibold">{e.valor}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {isFetching && !data && (
            <div className="py-8 text-center text-[13px] text-muted-foreground">Carregando…</div>
          )}
          {error && <Aviso tom="erro">Falha ao carregar: {mensagemAmigavel(error)}</Aviso>}
          {data && (
            <CorpoDoRelatorio
              r={data}
              codigos={herdados.codigos}
              nomeCurto={empresa}
              modoPrevistos={modoPrevistos}
              onModoPrevistos={setModoPrevistos}
            />
          )}
        </div>

        <DialogFooter className="border-t border-border px-5 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (data) {
                const csv = csvDoRelatorio(data, modoPrevistos, herdados.filtros);
                exportarCsvEmSecoes(csv.arquivo, csv.linhas);
              }
            }}
            disabled={!data}
          >
            <FileText aria-hidden /> Exportar CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (data)
                exportarExcel({
                  ...excelDoRelatorio(data, herdados.codigos, herdados.filtros),
                  empresa: marca,
                }).catch(falhou);
            }}
            disabled={!data}
          >
            <FileSpreadsheet aria-hidden /> Exportar Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (data)
                imprimirDocumento({
                  ...impressaoDoRelatorio(data, modoPrevistos, herdados.filtros),
                  empresa: marca,
                }).catch(falhou);
            }}
            disabled={!data}
          >
            <Printer aria-hidden /> Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CorpoDoRelatorio({
  r,
  codigos,
  nomeCurto,
  modoPrevistos,
  onModoPrevistos,
}: {
  r: RelatorioPeriodo;
  codigos: string[];
  nomeCurto: string;
  modoPrevistos: "todos" | "periodo";
  onModoPrevistos: (m: "todos" | "periodo") => void;
}) {
  const indicadores = indicadoresDoRelatorio(r, codigos);
  const a = r.atual;
  const cmp = r.comparativo;
  const meta = r.limites.slaMetaPct;
  const prev = modoPrevistos === "todos" ? r.previstosTodos : r.previstosPeriodo;
  const secao = (nome: Indicador["secao"]) => indicadores.filter((i) => i.secao === nome);
  const titulo = "label-xs";
  return (
    <div className="space-y-4">
      <div className="text-[12.5px] text-muted-foreground">
        Período principal:{" "}
        <strong className="text-foreground">
          {dataBr(r.periodo.inicio)} → {dataBr(r.periodo.fim)}
        </strong>
        {cmp && (
          <>
            {" · "}Comparativo:{" "}
            <strong className="text-foreground">
              {dataBr(cmp.periodo.inicio)} → {dataBr(cmp.periodo.fim)}
            </strong>
          </>
        )}
      </div>

      <section className="space-y-2">
        <h4 className={titulo}>Produção</h4>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {secao("Produção").map((i) => (
            <CartaoDoIndicador key={i.rotulo} i={i} />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h4 className={titulo}>Qualidade</h4>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-7">
          {secao("Qualidade").map((i) => (
            <CartaoDoIndicador key={i.rotulo} i={i} />
          ))}
        </div>
        <p className="rounded-lg border border-border bg-muted px-4 py-2.5 text-[12.5px] text-muted-foreground">
          Prejuízo conta apenas os CT-e cuja ocorrência penalizante é{" "}
          {codigos.length > 0
            ? `um dos códigos selecionados (${codigos.join(", ")})`
            : "o código 13 (padrão do sistema)"}
          .
        </p>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="label-xs mb-3">Como estão os CTRCs em relação ao prazo</div>
          <DistribuicaoPontualidade
            noPrazo={a.noPrazo}
            foraPrazo={a.foraPrazo}
            excluidoCliente={a.pendentePrazo}
            semInfo={a.semPrazo}
            nomeCurto={nomeCurto}
          />
        </div>
      </section>

      <div className="rounded-xl border border-status-bad/30 bg-status-bad-bg p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className={titulo}>Penalizantes</span>
          {cmp && (
            <span className="text-xs text-muted-foreground">
              comparativo: {formatarInteiro(cmp.penalizantes.ocorrencias)} ocorrências ·{" "}
              {formatarInteiro(cmp.penalizantes.ctrcsAfetados)} CTRCs
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[22px] font-bold text-status-bad-fg tabular-nums">
            {formatarInteiro(r.penalizantes.ocorrencias)}
          </span>
          <span className="text-[13px] text-muted-foreground">
            ocorrências ·{" "}
            <strong className="text-foreground">
              {formatarInteiro(r.penalizantes.ctrcsAfetados)}
            </strong>{" "}
            CTRCs afetados
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <div className="text-[15px] font-bold">Previstos</div>
            <div className="text-[12.5px] text-muted-foreground">
              CTRCs ainda não entregues · {formatarInteiro(prev.total.qtd)} no total ·{" "}
              {formatarMoeda(prev.total.frete)}
            </div>
          </div>
          <Alternador
            rotulo="Previstos"
            tamanho="pequeno"
            valor={modoPrevistos}
            aoMudar={onModoPrevistos}
            opcoes={[
              { valor: "todos", rotulo: "Todos em aberto" },
              { valor: "periodo", rotulo: "Emitidos no período" },
            ]}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
          {(
            [
              ["Por status da última ocorrência", prev.status],
              ["Por faixa de vencimento", prev.faixa],
            ] as const
          ).map(([nome, itens]) => (
            <div key={nome}>
              <div className="label-xs mb-2">{nome}</div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {itens.map((b) => (
                  <div
                    key={b.key}
                    className={
                      "rounded-lg border px-2.5 py-2 " +
                      (b.key === "vencido"
                        ? "border-status-bad/30 bg-status-bad-bg text-status-bad-fg"
                        : "border-border bg-muted/60 text-muted-foreground")
                    }
                  >
                    <div className="text-xs font-semibold tracking-wide uppercase">{b.key}</div>
                    <div className="text-[15px] font-bold text-foreground tabular-nums">
                      {formatarInteiro(b.qtd)}
                    </div>
                    <div className="text-xs text-muted-foreground">{formatarMoeda(b.frete)}</div>
                  </div>
                ))}
                {itens.length === 0 && (
                  <div className="col-span-full text-center text-[12.5px] text-muted-foreground">
                    Sem dados.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <TabelaSlaPorUnidade r={r} meta={meta} />

      {r.finalizadoPorCodigo.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-baseline justify-between border-b border-border px-4 py-3 text-[15px] font-bold">
            <span>Finalizado em Sistema por código</span>
            <span className="text-xs font-normal text-muted-foreground">
              total: {formatarInteiro(a.finalizadoSistema)} CTRCs
            </span>
          </div>
          <table className="w-full text-[13px]">
            <thead className="bg-muted/70 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Código</th>
                <th className="px-4 py-2.5 text-left font-medium">Descrição</th>
                <th className="px-4 py-2.5 text-right font-medium">Qtd</th>
              </tr>
            </thead>
            <tbody>
              {r.finalizadoPorCodigo.map((f) => (
                <tr key={f.codigo} className="border-t border-border hover:bg-muted/60">
                  <td className="px-4 py-2.5 font-mono text-xs">{f.codigo}</td>
                  <td className="px-4 py-2.5">{f.descricao ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatarInteiro(f.qtd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {r.impactoCodigos.length > 0 && <TabelaDeImpacto r={r} />}
    </div>
  );
}

function CartaoDoIndicador({ i }: { i: Indicador }) {
  const tom = (t: string) =>
    t === "bom" ? "text-status-good-fg" : t === "ruim" ? "text-status-bad-fg" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5" title={i.dica}>
      <div className="label-xs">{i.rotulo}</div>
      {i.legenda ? (
        <div className="mt-0.5 text-xs leading-tight text-muted-foreground">{i.legenda}</div>
      ) : null}
      <div className={"mt-1 text-[18px] font-bold tabular-nums " + tom(i.tom)}>{i.valor}</div>
      {i.comparativo && (
        <div className="mt-1 flex items-baseline gap-1 text-xs">
          <span className="text-muted-foreground">vs</span>
          <span className="text-foreground/80 tabular-nums">{i.comparativo.valor}</span>
          {i.comparativo.delta && (
            <span
              className={
                "ml-auto font-semibold tabular-nums " +
                (i.comparativo.delta.tom === "neutro"
                  ? "text-muted-foreground"
                  : tom(i.comparativo.delta.tom))
              }
            >
              {i.comparativo.delta.texto}
            </span>
          )}
        </div>
      )}
      {i.sub ? <div className="mt-0.5 text-xs text-muted-foreground">{i.sub}</div> : null}
    </div>
  );
}

function TabelaSlaPorUnidade({ r, meta }: { r: RelatorioPeriodo; meta: number }) {
  const cmp = r.comparativo;
  const doComparativo = new Map((cmp?.porUnidade ?? []).map((u) => [u.sigla, u]));
  const corDoSla = (v: number | null) =>
    v == null
      ? ""
      : v >= meta
        ? "text-status-good-fg"
        : v < meta - 5
          ? "font-semibold text-status-bad-fg"
          : "";
  const th = "px-4 py-2.5 text-right font-medium";
  const td = "px-4 py-2.5 text-right tabular-nums";
  const tdC = `${td} text-muted-foreground`;
  const p = cmp ? " (P)" : "";
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3 text-[15px] font-bold">
        SLA por unidade · meta {formatarPercentual(meta, { escala: "cem" })}
        {cmp && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            (P = principal · C = comparativo)
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/70 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Unidade</th>
              {(["Emitidos", "Entregues", "% Produção", "SLA Pont.", "SLA Op."] as const).map(
                (c) => (
                  <Fragment key={c}>
                    <th className={th}>
                      {c}
                      {p}
                    </th>
                    {cmp && <th className={th}>{c} (C)</th>}
                  </Fragment>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {r.porUnidade.length === 0 && (
              <tr>
                <td colSpan={cmp ? 11 : 6} className="px-3 py-6 text-center text-muted-foreground">
                  Sem unidades com movimento no período.
                </td>
              </tr>
            )}
            {r.porUnidade.map((u) => {
              const c = doComparativo.get(u.sigla);
              const comp = (v: string) => (cmp ? <td className={tdC}>{c ? v : "—"}</td> : null);
              return (
                <tr key={u.sigla} className="border-t border-border hover:bg-muted/60">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{u.sigla}</div>
                    {u.cidade ? (
                      <div className="text-xs text-muted-foreground">
                        {u.cidade}
                        {u.uf ? `/${u.uf}` : ""}
                      </div>
                    ) : null}
                  </td>
                  <td className={td}>{formatarInteiro(u.total)}</td>
                  {comp(formatarInteiro(c?.total ?? 0))}
                  <td className={td}>{formatarInteiro(u.entregues)}</td>
                  {comp(formatarInteiro(c?.entregues ?? 0))}
                  <td className={td}>{formatarPercentual(u.producaoPct, { escala: "cem" })}</td>
                  {comp(formatarPercentual(c?.producaoPct ?? null, { escala: "cem" }))}
                  <td className={`${td} ${corDoSla(u.slaOperacionalPct)}`}>
                    {formatarPercentual(u.slaOperacionalPct, { escala: "cem" })}
                  </td>
                  {comp(formatarPercentual(c?.slaOperacionalPct ?? null, { escala: "cem" }))}
                  <td className={td}>
                    {formatarPercentual(u.slaPontualidadePct, { escala: "cem" })}
                  </td>
                  {comp(formatarPercentual(c?.slaPontualidadePct ?? null, { escala: "cem" }))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabelaDeImpacto({ r }: { r: RelatorioPeriodo }) {
  const cmp = r.comparativo;
  const doComparativo = new Map((cmp?.impactoCodigos ?? []).map((i) => [i.codigo, i]));
  const pct = (v: number) => formatarPercentual(v, { escala: "cem" });
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-baseline justify-between border-b border-border px-4 py-3 text-[15px] font-bold">
        <span>Impacto por código de última ocorrência</span>
        <span className="text-xs font-normal text-muted-foreground">
          base: {formatarInteiro(r.impactoBaseComOcorrencia)} CTRCs com ocorrência registrada
          {cmp && ` · comparativo: ${formatarInteiro(cmp.impactoBaseComOcorrencia)}`}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/70 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Código</th>
              <th className="px-4 py-2.5 text-left font-medium">Descrição</th>
              <th className="px-4 py-2.5 text-right font-medium">CTRCs {cmp && "(P)"}</th>
              {cmp && <th className="px-4 py-2.5 text-right font-medium">CTRCs (C)</th>}
              <th className="px-4 py-2.5 text-right font-medium">% total {cmp && "(P)"}</th>
              {cmp && <th className="px-4 py-2.5 text-right font-medium">% total (C)</th>}
            </tr>
          </thead>
          <tbody>
            {r.impactoCodigos.slice(0, 20).map((i) => {
              const c = doComparativo.get(i.codigo);
              return (
                <tr key={i.codigo} className="border-t border-border hover:bg-muted/60">
                  <td className="px-4 py-2.5 font-mono text-xs">{i.codigo}</td>
                  <td className="px-4 py-2.5">
                    <span className={i.penaliza ? "text-status-bad-fg" : ""}>
                      {i.descricao ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatarInteiro(i.totalCtrcs)}
                  </td>
                  {cmp && (
                    <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                      {c ? formatarInteiro(c.totalCtrcs) : "—"}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right tabular-nums">{pct(i.pctDoTotal)}</td>
                  {cmp && (
                    <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                      {c ? pct(c.pctDoTotal) : "—"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
