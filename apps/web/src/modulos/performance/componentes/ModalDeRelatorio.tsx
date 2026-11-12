import { type Periodo, resolverPeriodo } from "@erp/dominio/performance/tela";
import { type FiltroPerformanceEntrada } from "@erp/shared/contratos/performance";
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
import { useState } from "react";
import { toast } from "sonner";

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

import { consultaRelatorio } from "../api";
import { csvDoRelatorio, excelDoRelatorio, impressaoDoRelatorio } from "../exportacao";
import { dataBr, etiquetasDoRelatorio, type FiltrosDoRelatorio } from "../textos";
import { CorpoDoRelatorio } from "./CorpoDoRelatorio";

interface FiltrosHerdados {
  entrada: Omit<FiltroPerformanceEntrada, "inicio" | "fim" | "baseData">;
  codigos: string[];
  /** Filtros por extenso: etiquetas, CSV, impressão e notas da aba "Resumo" do Excel. */
  filtros: FiltrosDoRelatorio;
}

/** Relatório de período: janela própria (padrão "Hoje"), comparativo opcional e exportação. */
export function ModalDeRelatorio({
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
