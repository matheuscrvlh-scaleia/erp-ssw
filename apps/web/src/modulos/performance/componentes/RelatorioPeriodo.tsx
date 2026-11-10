import { type Periodo, resolverPeriodo } from "@erp/dominio/performance/tela";
import {
  type FiltroPerformanceEntrada,
  type RelatorioPeriodo,
} from "@erp/shared/contratos/performance";
import { hojeNoFuso } from "@erp/shared/datas";
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

import { FiltroPeriodo } from "@/componentes/comum/FiltroPeriodo";
import { useEmpresaDaExportacao } from "@/componentes/comum/use-empresa-da-exportacao";
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
import { exportarCsv, exportarExcel, imprimir } from "@/lib/exportacao";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { SeloDosDados } from "@/modulos/ingestao-ssw/SeloDosDados";

import { consultaRelatorio } from "../api";
import { fmtInt, fmtPct100 } from "../formato";
import { type Indicador, indicadoresDoRelatorio, linhasDoCsv } from "../relatorio";
import { DistribuicaoPontualidade } from "./Kpis";

const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export interface FiltrosHerdados {
  entrada: Omit<FiltroPerformanceEntrada, "inicio" | "fim" | "baseData">;
  codigos: string[];
  etiquetas: { rotulo: string; valor: string }[];
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
  const [modoPrevistos, setModoPrevistos] = useState<"todos" | "periodo">("periodo");

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
  const exportacao = (r: RelatorioPeriodo) => ({
    arquivo: "relatorio-periodo",
    titulo: "Relatório de período",
    subtitulo: `${dataBr(inicio)} → ${dataBr(fim)}${herdados.etiquetas.length ? ` · ${herdados.etiquetas.map((e) => `${e.rotulo}: ${e.valor}`).join(" | ")}` : ""}`,
    empresa: marca,
    colunas: [
      { chave: "secao", titulo: "Seção" },
      { chave: "item", titulo: "Indicador" },
      { chave: "valor", titulo: "Valor" },
      { chave: "comparativo", titulo: "Comparativo" },
    ],
    linhas: linhasDoCsv(r, herdados.codigos),
  });
  const falhou = (e: unknown) => {
    toast.error("Não foi possível gerar o arquivo", { description: mensagemAmigavel(e) });
  };

  return (
    <Dialog open={aberto} onOpenChange={onAberto}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden p-0">
        <DialogHeader className="space-y-1 border-b border-border/60 px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-[14px]">
            <FileBarChart className="h-4 w-4 text-muted-foreground" />
            Relatório de período
          </DialogTitle>
          <SeloDosDados mostrarXml className="!text-[11px]" />
          <DialogDescription className="text-[11px]">
            Visão consolidada da operação no período selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-[var(--brand)]/40 bg-[var(--brand)]/5 px-3 py-2">
              <Info className="h-3.5 w-3.5 text-[var(--brand)]" />
              <span className="text-[11px] font-medium text-[var(--brand)]">
                Período próprio do relatório
              </span>
              <span className="text-[11px] text-muted-foreground">
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

            <div className="rounded-md border border-border/70 bg-card">
              <button
                type="button"
                onClick={() => {
                  setComparativoAberto((v) => !v);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] font-medium hover:bg-muted/40"
              >
                <span className="flex items-center gap-2">
                  <GitCompareArrows className="h-3.5 w-3.5 text-muted-foreground" />
                  Comparar com outro período
                  {comparativoAtivo && (
                    <span className="ml-1 rounded-md border border-border/70 px-1.5 text-[10px] font-normal">
                      {dataBr(cmpDe)} → {dataBr(cmpAte)}
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {comparativoAberto ? "ocultar" : "mostrar"}
                </span>
              </button>
              {comparativoAberto && (
                <div className="flex flex-wrap items-center gap-3 border-t border-border/60 px-3 py-2">
                  <label className="flex items-center gap-2 text-[12px]">
                    <Switch checked={comparar} onCheckedChange={setComparar} />
                    <span className={comparar ? "text-foreground" : "text-muted-foreground"}>
                      Ativar comparativo
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Período secundário:</span>
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
                    <span className="text-[11px] text-amber-600">
                      Selecione as datas do período secundário.
                    </span>
                  )}
                </div>
              )}
            </div>

            {herdados.etiquetas.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">
                  Filtros herdados da barra principal:
                </span>
                {herdados.etiquetas.map((e) => (
                  <span
                    key={e.rotulo}
                    className="rounded-md border border-border/70 bg-muted/50 px-1.5 text-[11px]"
                  >
                    <span className="text-muted-foreground">{e.rotulo}:</span>
                    <span className="ml-1">{e.valor}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {isFetching && !data && (
            <div className="py-8 text-center text-[13px] text-muted-foreground">Carregando…</div>
          )}
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-[12px] text-red-800">
              Falha ao carregar: {mensagemAmigavel(error)}
            </div>
          )}
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

        <DialogFooter className="border-t border-border/60 px-5 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (data) exportarCsv({ ...exportacao(data), fuso });
            }}
            disabled={!data}
          >
            <FileText className="mr-1.5 h-4 w-4" /> Exportar CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (data) exportarExcel(exportacao(data)).catch(falhou);
            }}
            disabled={!data}
          >
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Exportar Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (data) imprimir(exportacao(data)).catch(falhou);
            }}
            disabled={!data}
          >
            <Printer className="mr-1.5 h-4 w-4" /> Imprimir
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
  const titulo = "text-[10px] font-semibold tracking-wider text-muted-foreground uppercase";
  return (
    <div className="space-y-4">
      <div className="text-[11px] text-muted-foreground">
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
        <p className="rounded-md border border-border/70 bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
          Prejuízo conta apenas os CT-e cuja ocorrência penalizante é{" "}
          {codigos.length > 0
            ? `um dos códigos selecionados (${codigos.join(", ")})`
            : "o código 13 (padrão do sistema)"}
          .
        </p>
        <div className="rounded-lg border border-border/70 bg-card p-3">
          <div className="mb-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Como estão os CTRCs em relação ao prazo
          </div>
          <DistribuicaoPontualidade
            noPrazo={a.noPrazo}
            foraPrazo={a.foraPrazo}
            excluidoCliente={a.pendentePrazo}
            semInfo={a.semPrazo}
            nomeCurto={nomeCurto}
          />
        </div>
      </section>

      <div
        className="rounded-lg border border-l-[5px] border-border/70 bg-card p-4"
        style={{ borderLeftColor: "var(--status-bad)" }}
      >
        <div className="mb-2 flex items-baseline justify-between">
          <span className={titulo}>Penalizantes</span>
          {cmp && (
            <span className="text-[10px] text-muted-foreground">
              comparativo: {fmtInt(cmp.penalizantes.ocorrencias)} ocorrências ·{" "}
              {fmtInt(cmp.penalizantes.ctrcsAfetados)} CTRCs
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className="text-[22px] font-semibold tabular-nums"
            style={{ color: "var(--status-bad)" }}
          >
            {fmtInt(r.penalizantes.ocorrencias)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            ocorrências ·{" "}
            <strong className="text-foreground">{fmtInt(r.penalizantes.ctrcsAfetados)}</strong>{" "}
            CTRCs afetados
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-border/70 bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-3 py-2">
          <div>
            <div className="text-[12px] font-medium">Previstos</div>
            <div className="text-[10px] text-muted-foreground">
              CTRCs ainda não entregues · {fmtInt(prev.total.qtd)} no total ·{" "}
              {reais(prev.total.frete)}
            </div>
          </div>
          <div className="flex rounded-md border border-border/70 p-0.5 text-[11px]">
            {(["todos", "periodo"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  onModoPrevistos(m);
                }}
                className={
                  "rounded-[5px] px-2.5 py-1 " +
                  (modoPrevistos === m
                    ? "bg-[var(--brand)] text-white"
                    : "text-muted-foreground hover:bg-muted")
                }
              >
                {m === "todos" ? "Todos em aberto" : "Emitidos no período"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2">
          {(
            [
              ["Por status da última ocorrência", prev.status],
              ["Por faixa de vencimento", prev.faixa],
            ] as const
          ).map(([nome, itens]) => (
            <div key={nome}>
              <div className="mb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                {nome}
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {itens.map((b) => (
                  <div
                    key={b.key}
                    className={
                      "rounded border p-2 " +
                      (b.key === "vencido"
                        ? "border-red-200 bg-red-50"
                        : "border-border/60 bg-muted/30")
                    }
                  >
                    <div
                      className={
                        "text-[10px] uppercase " +
                        (b.key === "vencido" ? "text-red-700" : "text-muted-foreground")
                      }
                    >
                      {b.key}
                    </div>
                    <div className="text-[15px] font-semibold tabular-nums">{fmtInt(b.qtd)}</div>
                    <div className="text-[9px] text-muted-foreground">{reais(b.frete)}</div>
                  </div>
                ))}
                {itens.length === 0 && (
                  <div className="col-span-full text-center text-[11px] text-muted-foreground">
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
        <div className="rounded-lg border border-border/70">
          <div className="flex items-baseline justify-between border-b border-border/70 px-3 py-2 text-[12px] font-medium">
            <span>Finalizado em Sistema por código</span>
            <span className="text-[10px] text-muted-foreground">
              total: {fmtInt(a.finalizadoSistema)} CTRCs
            </span>
          </div>
          <table className="w-full text-[12px]">
            <thead className="bg-muted/50 text-[10px] tracking-wider text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Código</th>
                <th className="px-3 py-2 text-left font-medium">Descrição</th>
                <th className="px-3 py-2 text-right font-medium">Qtd</th>
              </tr>
            </thead>
            <tbody>
              {r.finalizadoPorCodigo.map((f) => (
                <tr key={f.codigo} className="border-t border-border/70">
                  <td className="px-3 py-2 font-mono text-[11px]">{f.codigo}</td>
                  <td className="px-3 py-2">{f.descricao ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtInt(f.qtd)}</td>
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
    t === "bom" ? "text-emerald-600" : t === "ruim" ? "text-red-600" : "text-foreground";
  return (
    <div className="rounded-lg border border-border/70 bg-card p-3" title={i.dica}>
      <div className="text-[10px] tracking-wide text-muted-foreground uppercase">{i.rotulo}</div>
      {i.legenda ? (
        <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground/90">{i.legenda}</div>
      ) : null}
      <div className={"mt-1 text-[16px] font-semibold tabular-nums " + tom(i.tom)}>{i.valor}</div>
      {i.comparativo && (
        <div className="mt-1 flex items-baseline gap-1 text-[10px]">
          <span className="text-muted-foreground">vs</span>
          <span className="text-foreground/80 tabular-nums">{i.comparativo.valor}</span>
          {i.comparativo.delta && (
            <span
              className={
                "ml-auto font-medium tabular-nums " +
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
      {i.sub ? <div className="mt-0.5 text-[10px] text-muted-foreground">{i.sub}</div> : null}
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
        ? "text-emerald-600"
        : v < meta - 5
          ? "font-medium text-red-600"
          : "";
  const th = "px-3 py-2 text-right font-medium";
  const td = "px-3 py-2 text-right tabular-nums";
  const tdC = `${td} text-muted-foreground`;
  const p = cmp ? " (P)" : "";
  return (
    <div className="rounded-lg border border-border/70">
      <div className="border-b border-border/70 px-3 py-2 text-[12px] font-medium">
        SLA por unidade · meta {meta.toFixed(1).replace(".", ",")}%
        {cmp && (
          <span className="ml-2 text-[10px] font-normal text-muted-foreground">
            (P = principal · C = comparativo)
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-muted/50 text-[10px] tracking-wider text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Unidade</th>
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
                <tr key={u.sigla} className="border-t border-border/70">
                  <td className="px-3 py-2">
                    <div className="font-medium">{u.sigla}</div>
                    {u.cidade ? (
                      <div className="text-[10px] text-muted-foreground">
                        {u.cidade}
                        {u.uf ? `/${u.uf}` : ""}
                      </div>
                    ) : null}
                  </td>
                  <td className={td}>{fmtInt(u.total)}</td>
                  {comp(fmtInt(c?.total ?? 0))}
                  <td className={td}>{fmtInt(u.entregues)}</td>
                  {comp(fmtInt(c?.entregues ?? 0))}
                  <td className={td}>{fmtPct100(u.producaoPct)}</td>
                  {comp(fmtPct100(c?.producaoPct ?? null))}
                  <td className={`${td} ${corDoSla(u.slaOperacionalPct)}`}>
                    {fmtPct100(u.slaOperacionalPct)}
                  </td>
                  {comp(fmtPct100(c?.slaOperacionalPct ?? null))}
                  <td className={td}>{fmtPct100(u.slaPontualidadePct)}</td>
                  {comp(fmtPct100(c?.slaPontualidadePct ?? null))}
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
  const pct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;
  return (
    <div className="rounded-lg border border-border/70">
      <div className="flex items-baseline justify-between border-b border-border/70 px-3 py-2 text-[12px] font-medium">
        <span>Impacto por código de última ocorrência</span>
        <span className="text-[10px] text-muted-foreground">
          base: {fmtInt(r.impactoBaseComOcorrencia)} CTRCs com ocorrência registrada
          {cmp && ` · comparativo: ${fmtInt(cmp.impactoBaseComOcorrencia)}`}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-muted/50 text-[10px] tracking-wider text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Código</th>
              <th className="px-3 py-2 text-left font-medium">Descrição</th>
              <th className="px-3 py-2 text-right font-medium">CTRCs {cmp && "(P)"}</th>
              {cmp && <th className="px-3 py-2 text-right font-medium">CTRCs (C)</th>}
              <th className="px-3 py-2 text-right font-medium">% total {cmp && "(P)"}</th>
              {cmp && <th className="px-3 py-2 text-right font-medium">% total (C)</th>}
            </tr>
          </thead>
          <tbody>
            {r.impactoCodigos.slice(0, 20).map((i) => {
              const c = doComparativo.get(i.codigo);
              return (
                <tr key={i.codigo} className="border-t border-border/70">
                  <td className="px-3 py-2 font-mono text-[11px]">{i.codigo}</td>
                  <td className="px-3 py-2">
                    <span className={i.penaliza ? "text-red-600" : ""}>{i.descricao ?? "—"}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtInt(i.totalCtrcs)}</td>
                  {cmp && (
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                      {c ? fmtInt(c.totalCtrcs) : "—"}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right tabular-nums">{pct(i.pctDoTotal)}</td>
                  {cmp && (
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
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
