import { formatarData, formatarDataHora, formatarInteiro } from "@erp/shared/formatting";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUp, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { type ColunaTabela } from "@/components/common/data-table";
import { TabelaDados } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { mensagemAmigavel } from "@/lib/error-message";

import { type ArquivoImportado050, mutacaoImportar050 } from "../api";
import { conferenciaDoResumo } from "../texts";

function colunasDoResultado(fuso: string): ColunaTabela<ArquivoImportado050>[] {
  return [
    {
      chave: "arquivo",
      titulo: "Arquivo",
      classe: "max-w-[180px] truncate",
      celula: (l) => <span title={l.arquivo}>{l.arquivo}</span>,
    },
    {
      chave: "emitidoEm",
      titulo: "Emitido em",
      valor: (l) => l.resultado.emitidoEm,
      celula: (l) => formatarDataHora(l.resultado.emitidoEm, fuso),
    },
    {
      chave: "cadastro",
      titulo: "Cadastro",
      valor: ({ resultado: { periodoCadastro: p } }) =>
        p ? `${formatarData(p.inicio)} a ${formatarData(p.fim)}` : "—",
    },
    { chave: "lidas", titulo: "Lidas", formato: "inteiro", valor: (l) => l.resultado.lidas },
    {
      chave: "gravadas",
      titulo: "Gravadas",
      formato: "inteiro",
      valor: (l) => l.resultado.gravadas,
      celula: ({ resultado: r }) => (
        <>
          {formatarInteiro(r.gravadas)}
          {r.ignoradas > 0 && (
            <span
              className="text-muted-foreground"
              title="Sem unidade/número, repetidas no arquivo ou já gravadas por um relatório mais novo"
            >
              {" "}
              (+{formatarInteiro(r.ignoradas)} ignoradas)
            </span>
          )}
        </>
      ),
    },
    {
      chave: "conferencia",
      titulo: "Conferência",
      ordenavel: false,
      celula: ({ resultado: r }) => {
        const conferencia = conferenciaDoResumo(r);
        return (
          <span className={conferencia.ok ? undefined : "font-semibold text-status-bad-fg"}>
            {conferencia.texto}
            {r.avisos.length > 0 && ` · ${String(r.avisos.length)} aviso(s)`}
          </span>
        );
      },
    },
  ];
}

/**
 * Importação manual do relatório 050 (impresso ou CSV), um ou vários arquivos. Coleta já gravada
 * por um relatório mais novo não é sobrescrita (o servidor conta como "ignorada").
 */
export function ModalDeImportacao050({
  aberto,
  aoMudarAberto,
  fuso,
}: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  fuso: string;
}) {
  const queryClient = useQueryClient();
  const importar050 = useMutation(mutacaoImportar050(queryClient));
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<ArquivoImportado050[]>([]);

  const importar = async () => {
    if (arquivos.length === 0) {
      toast.error("Selecione o(s) arquivo(s) do 050 exportado(s) do SSW.");
      return;
    }
    setEnviando(true);
    await importar050.mutateAsync({
      arquivos,
      aoRecusarPorTamanho: (arquivo) => {
        toast.error(`${arquivo.name}: arquivo grande demais. Exporte um período menor no SSW.`);
      },
      aoFalhar: (arquivo, e) => {
        toast.error(`${arquivo.name}: ${mensagemAmigavel(e)}`);
      },
      aoConcluir: (novos) => {
        setResultados((antes) => [...novos, ...antes]);
        setEnviando(false);
        if (novos.length > 0) {
          const gravadas = novos.reduce((s, n) => s + n.resultado.gravadas, 0);
          toast.success(
            `${formatarInteiro(gravadas)} coleta(s) gravada(s) de ${String(novos.length)} arquivo(s)`,
          );
        }
      },
    });
  };

  return (
    <Dialog open={aberto} onOpenChange={aoMudarAberto}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>Importar relatório 050</DialogTitle>
        <div className="min-w-0 space-y-4 text-[13px]">
          <p className="text-muted-foreground">
            Exporte a opção 050 do SSW (impresso ou CSV) e selecione um ou mais arquivos. A coleta
            já gravada por um relatório mais novo não é sobrescrita.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              multiple
              accept=".txt,.csv,.prn,text/plain,text/csv"
              aria-label="Arquivos do 050"
              onChange={(e) => {
                setArquivos([...(e.target.files ?? [])]);
              }}
              className="h-9 max-w-[360px] text-[13px] file:mr-3 file:h-9 file:cursor-pointer file:rounded-lg file:border file:border-border file:bg-card file:px-3 file:text-[13px] file:font-medium file:text-foreground"
            />
            <Button size="sm" onClick={() => void importar()} disabled={enviando}>
              {enviando ? <Loader2 className="animate-spin" aria-hidden /> : <FileUp aria-hidden />}
              Importar
            </Button>
          </div>
          {resultados.length > 0 && (
            <TabelaDados
              colunas={colunasDoResultado(fuso)}
              linhas={resultados}
              chaveDaLinha={(l) => l.chave}
              porPagina={0}
              rotuloTotal={(n) => `${formatarInteiro(n)} arquivo(s)`}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
