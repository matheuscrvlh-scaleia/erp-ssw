import {
  contratosColetas as c,
  type ResultadoDaImportacao050,
  TAMANHO_MAXIMO_DO_050,
} from "@erp/shared/contratos/coletas";
import { formatarData, formatarDataHora, formatarInteiro } from "@erp/shared/formatacao";
import { useQueryClient } from "@tanstack/react-query";
import { FileUp, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { type ColunaTabela } from "@/componentes/comum/tabela-dados";
import { TabelaDados } from "@/componentes/comum/TabelaDados";
import { Button } from "@/componentes/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/componentes/ui/dialog";
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";

import { CHAVE_DAS_COLETAS } from "./api";

interface ArquivoImportado {
  /** Arquivo + ordem do envio (o mesmo arquivo pode ser importado de novo). */
  chave: string;
  arquivo: string;
  resultado: ResultadoDaImportacao050;
}

function colunasDoResultado(fuso: string): ColunaTabela<ArquivoImportado>[] {
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

/** Confere o que foi lido com o quadro RESUMO do próprio 050. */
export function conferenciaDoResumo(r: ResultadoDaImportacao050): {
  ok: boolean;
  texto: string;
} {
  if (r.resumoSsw === null) return { ok: true, texto: "sem quadro de resumo" };
  if (r.resumoSsw.quantidade === r.lidas) {
    return { ok: true, texto: `ok — ${formatarInteiro(r.resumoSsw.quantidade)} coletas no resumo` };
  }
  return {
    ok: false,
    texto: `resumo do SSW diz ${formatarInteiro(r.resumoSsw.quantidade)}, lidas ${formatarInteiro(r.lidas)}`,
  };
}

/** O 050 sai do SSW em ISO-8859-1 (impresso ou CSV); o servidor recebe o texto já decodificado. */
export async function lerArquivo050(arquivo: Pick<Blob, "arrayBuffer">): Promise<string> {
  return new TextDecoder("iso-8859-1").decode(await arquivo.arrayBuffer());
}

/**
 * Importação manual do relatório 050 (impresso ou CSV), um ou vários arquivos. Coleta já gravada
 * por um relatório mais novo não é sobrescrita (o servidor conta como "ignorada").
 */
export function Importador050({
  aberto,
  aoMudarAberto,
  fuso,
}: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  fuso: string;
}) {
  const queryClient = useQueryClient();
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<ArquivoImportado[]>([]);

  const importar = async () => {
    if (arquivos.length === 0) {
      toast.error("Selecione o(s) arquivo(s) do 050 exportado(s) do SSW.");
      return;
    }
    setEnviando(true);
    const novos: ArquivoImportado[] = [];
    for (const arquivo of arquivos) {
      try {
        const conteudo = await lerArquivo050(arquivo);
        if (conteudo.length > TAMANHO_MAXIMO_DO_050) {
          toast.error(`${arquivo.name}: arquivo grande demais. Exporte um período menor no SSW.`);
          continue;
        }
        const resultado = await chamar(c.importar050, {
          entrada: { conteudo, arquivoOrigem: arquivo.name },
        });
        novos.push({
          chave: `${arquivo.name}-${String(Date.now())}-${String(novos.length)}`,
          arquivo: arquivo.name,
          resultado,
        });
      } catch (e) {
        toast.error(`${arquivo.name}: ${mensagemAmigavel(e)}`);
      }
    }
    setResultados((antes) => [...novos, ...antes]);
    setEnviando(false);
    if (novos.length > 0) {
      const gravadas = novos.reduce((s, n) => s + n.resultado.gravadas, 0);
      toast.success(
        `${formatarInteiro(gravadas)} coleta(s) gravada(s) de ${String(novos.length)} arquivo(s)`,
      );
      await queryClient.invalidateQueries({ queryKey: CHAVE_DAS_COLETAS });
    }
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
