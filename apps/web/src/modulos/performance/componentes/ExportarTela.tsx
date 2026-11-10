import {
  contratosPerformance as c,
  type FiltroPerformanceEntrada,
  type LinhaExportacao,
} from "@erp/shared/contratos/performance";
import { Download, FileText, FileType2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/componentes/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";
import { chamar } from "@/lib/api";

import { type ColunaExportada, exportarCsv, imprimir } from "../exportacao-local";

type Linha = Omit<LinhaExportacao, "dataEmissao" | "dataHora"> & {
  dataEmissao: string;
  dataHora: string;
};

const COLUNAS: ColunaExportada<Linha>[] = [
  { chave: "numeroNf", titulo: "NF" },
  { chave: "numero", titulo: "CTRC" },
  { chave: "dataEmissao", titulo: "Data emissão" },
  { chave: "unidade", titulo: "Unidade" },
  { chave: "remetente", titulo: "Remetente" },
  { chave: "destinatario", titulo: "Destinatário" },
  { chave: "cidadeDestino", titulo: "Cidade destino" },
  { chave: "peso", titulo: "Peso (kg)" },
  { chave: "volumes", titulo: "Volumes" },
  { chave: "valorFrete", titulo: "Frete (R$)" },
  { chave: "placaRomaneio", titulo: "Placa (romaneio)" },
  { chave: "motorista", titulo: "Motorista" },
  { chave: "placaColeta", titulo: "Placa coleta" },
  { chave: "placaEntrega", titulo: "Placa entrega" },
  { chave: "cteVinculo", titulo: "CT-e vínculo" },
  { chave: "romaneio", titulo: "Romaneio" },
  { chave: "codigo", titulo: "Código" },
  { chave: "descricao", titulo: "Descrição" },
  { chave: "dataHora", titulo: "Data/hora ocorrência" },
  { chave: "status", titulo: "Status" },
];

const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const dataHoraBr = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";

/**
 * Exportar da tela: uma linha por ocorrência dos CT-e filtrados (decisões Q13 e Q18).
 * TODO(kit-ui): trocar pelo ExportMenu do kit (Excel/PDF com a identidade da empresa).
 */
export function ExportarTela({
  entrada,
  periodo,
  empresa,
  desabilitado,
}: {
  entrada: FiltroPerformanceEntrada;
  periodo: string;
  empresa: string;
  desabilitado: boolean;
}) {
  const [ocupado, setOcupado] = useState(false);
  const exportar = async (formato: "csv" | "imprimir") => {
    setOcupado(true);
    try {
      const r = await chamar(c.exportacao, { entrada });
      if (r.linhas.length === 0) {
        toast.info("Nenhum CT-e para exportar com estes filtros.");
        return;
      }
      if (r.truncado)
        toast.warning("Arquivo limitado aos primeiros 10.000 CT-e. Reduza o período.");
      const dados = {
        arquivo: `performance-${periodo}`,
        titulo: "Performance",
        subtitulo: `${dataBr(entrada.inicio)} → ${dataBr(entrada.fim)}`,
        empresa,
        colunas: COLUNAS,
        linhas: r.linhas.map((l) => ({
          ...l,
          dataEmissao: dataBr(l.dataEmissao),
          dataHora: dataHoraBr(l.dataHora),
        })),
      };
      if (formato === "csv") exportarCsv(dados);
      else imprimir(dados);
    } catch (e) {
      toast.error("Não foi possível gerar o arquivo", {
        description: e instanceof Error ? e.message : "Tente reduzir o período ou os filtros.",
      });
    } finally {
      setOcupado(false);
    }
  };
  const item = "flex w-full items-center rounded px-2 py-1.5 text-left text-[12px] hover:bg-muted";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[12px]"
          disabled={desabilitado || ocupado}
        >
          <Download className="mr-1.5 h-3 w-3" />
          {ocupado ? "Exportando…" : "Exportar"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1">
        <button className={item} onClick={() => void exportar("csv")}>
          <FileText className="mr-2 h-3 w-3" /> CSV
        </button>
        <button className={item} onClick={() => void exportar("imprimir")}>
          <FileType2 className="mr-2 h-3 w-3" /> PDF
        </button>
      </PopoverContent>
    </Popover>
  );
}
