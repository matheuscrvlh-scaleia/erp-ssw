import { Download, FileSpreadsheet, FileText, FileType2, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mensagemAmigavel } from "@/lib/error-message";
import {
  type ColunaExportacao,
  type EmpresaExportacao,
  exportarCsv,
  exportarExcel,
  exportarPdf,
  imprimir,
  type LinhaExportacao,
  type Orientacao,
} from "@/lib/export";
import { cn } from "@/lib/utils";

import { ordenarPorPlaca } from "./sort-by-plate";
import { useEmpresaDaExportacao } from "./use-export-company";

type FormatoExportacao = "csv" | "excel" | "pdf" | "imprimir";

const ROTULO: Record<FormatoExportacao, string> = {
  csv: "CSV",
  excel: "Excel (.xlsx)",
  pdf: "PDF",
  imprimir: "Imprimir",
};

const ICONE: Record<FormatoExportacao, typeof FileText> = {
  csv: FileText,
  excel: FileSpreadsheet,
  pdf: FileType2,
  imprimir: Printer,
};

export interface ExportMenuProps<T extends LinhaExportacao> {
  /** Base do nome do arquivo, ex.: "romaneio-hoje" (a data entra sozinha). */
  arquivo: string;
  titulo: string;
  /** Contexto (período, filtros). O arquivo leva " · N registros" no fim. */
  subtitulo?: string | undefined;
  colunas: readonly ColunaExportacao[];
  /** Linhas já na tela: o arquivo respeita, por construção, os filtros ativos. */
  linhas: readonly T[];
  /** Busca todas as páginas com os mesmos filtros antes de exportar. */
  carregarLinhas?: (() => Promise<readonly T[]>) | undefined;
  /** Padrão: CSV, Excel e PDF. */
  formatos?: readonly FormatoExportacao[] | undefined;
  orientacao?: Orientacao | undefined;
  /** Fonte do PDF em pt (tabela larga usa menos). */
  tamanhoFonte?: number | undefined;
  /** Padrão: a empresa ativa. */
  empresa?: EmpresaExportacao | undefined;
  desabilitado?: boolean | undefined;
  /** Só o ícone, para cabeçalhos apertados. */
  soIcone?: boolean | undefined;
  className?: string | undefined;
}

const FORMATOS_PADRAO: readonly FormatoExportacao[] = ["csv", "excel", "pdf"];

/**
 * Botão "Exportar" padrão de qualquer tabela, gaveta ou gráfico. Ordena por placa quando há
 * coluna "Placa"; sem registros não gera arquivo, só avisa.
 * origem: ExportTabela.tsx (sistema atual)
 */
export function ExportMenu<T extends LinhaExportacao>({
  arquivo,
  titulo,
  subtitulo,
  colunas,
  linhas,
  carregarLinhas,
  formatos = FORMATOS_PADRAO,
  orientacao,
  tamanhoFonte,
  empresa,
  desabilitado,
  soIcone,
  className,
}: ExportMenuProps<T>) {
  const empresaAtiva = useEmpresaDaExportacao();
  const [ocupado, setOcupado] = useState(false);

  const exportar = async (formato: FormatoExportacao) => {
    setOcupado(true);
    try {
      const dados = carregarLinhas ? await carregarLinhas() : linhas;
      if (dados.length === 0) {
        toast.info("Nenhum registro no filtro atual — o arquivo não foi gerado.");
        return;
      }
      const ordenadas = ordenarPorPlaca(dados, colunas);
      const base = {
        titulo,
        subtitulo: `${subtitulo ? `${subtitulo} · ` : ""}${ordenadas.length} registros`,
        colunas,
        linhas: ordenadas,
        empresa: empresa ?? empresaAtiva,
      };
      switch (formato) {
        case "csv":
          exportarCsv({ arquivo, colunas, linhas: ordenadas, fuso: base.empresa.fuso });
          break;
        case "excel":
          await exportarExcel({ ...base, arquivo });
          break;
        case "pdf":
          await exportarPdf({ ...base, arquivo, orientacao, tamanhoFonte });
          break;
        case "imprimir":
          await imprimir({ ...base, orientacao });
          break;
      }
    } catch (erro) {
      console.error("[exportacao]", erro);
      toast.error("Não foi possível gerar o arquivo", { description: mensagemAmigavel(erro) });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9", soIcone && "w-9 px-0", className)}
          disabled={desabilitado || ocupado || (!carregarLinhas && linhas.length === 0)}
          title={`Exportar ${titulo}`}
          aria-label={`Exportar ${titulo}`}
          aria-busy={ocupado}
          // O botão não entra na captura da tela que vai para o PDF.
          data-exportacao-ignorar
        >
          <Download className="h-4 w-4" aria-hidden />
          {soIcone ? null : ocupado ? "Exportando…" : "Exportar"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {formatos.map((formato) => {
          const Icone = ICONE[formato];
          return (
            <DropdownMenuItem key={formato} onSelect={() => void exportar(formato)}>
              <Icone className="h-4 w-4 text-muted-foreground" aria-hidden /> {ROTULO[formato]}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
