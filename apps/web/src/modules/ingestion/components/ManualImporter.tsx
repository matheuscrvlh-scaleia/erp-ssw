/**
 * Importador manual de um relatório SSW: arquivo (latin-1) ou texto colado → "Processar" mostra a
 * prévia lida aqui no navegador (mesmo leitor do servidor) → "Gravar na staging".
 */
import { lerRelatorio, type Relatorio } from "@erp/domain/ingestion/reports";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, FileUp, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { type ColunaTabela, TabelaDados } from "@/components/common/DataTable";
import { Aviso } from "@/components/common/Notice";
import { SeloStatus } from "@/components/common/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { mensagemAmigavel } from "@/lib/error-message";
import { cn } from "@/lib/utils";

import { mutacaoImportarRelatorio } from "../api";
import { AreaDeTexto } from "./TextArea";

/** Colunas mostradas na prévia (o 455 tem 130; o resto aparece no arquivo gravado). */
const MAX_COLUNAS_NA_PREVIA = 12;

type Linha = Record<string, unknown> & { _linha: number };

export function ImportadorManual({ relatorio }: { relatorio: Relatorio }) {
  const queryClient = useQueryClient();
  const [conteudo, setConteudo] = useState("");
  const [nome, setNome] = useState<string | null>(null);
  const [analise, setAnalise] = useState<ReturnType<typeof lerRelatorio> | null>(null);
  const [aceitarDivergencia, setAceitarDivergencia] = useState(false);
  const [gravando, setGravando] = useState(false);
  const importar = useMutation(mutacaoImportarRelatorio(queryClient));

  const lerArquivo = async (arquivo: File) => {
    // Relatórios do SSW vêm em latin-1.
    const texto = new TextDecoder("iso-8859-1").decode(await arquivo.arrayBuffer());
    setConteudo(texto);
    setNome(arquivo.name);
    setAnalise(null);
  };

  const processar = () => {
    setAnalise(lerRelatorio(relatorio, conteudo));
    setAceitarDivergencia(false);
  };

  const linhas = useMemo<Linha[]>(
    () =>
      analise?.analise.registros.map((r) => ({
        ...(r.dados as Record<string, unknown>),
        _linha: r.linha,
      })) ?? [],
    [analise],
  );
  const colunas = useMemo<ColunaTabela<Linha>[]>(() => {
    const primeira = linhas[0];
    if (!primeira) return [];
    const chaves = Object.keys(primeira)
      .filter((k) => k !== "_linha")
      .slice(0, MAX_COLUNAS_NA_PREVIA);
    return [
      { chave: "_linha", titulo: "Linha", classe: "font-mono" },
      ...chaves.map((k) => ({
        chave: k,
        titulo: k.replace(/_/g, " ").toUpperCase(),
        classe: "whitespace-nowrap",
      })),
    ];
  }, [linhas]);

  const gravar = async () => {
    setGravando(true);
    try {
      await importar.mutateAsync({
        entrada: { relatorio, conteudo, nome, aceitarDivergencia },
        aoGravar: (r) => {
          toast.success(`${r.gravados} linha(s) gravada(s) na staging`, {
            description:
              r.erros > 0 ? `${r.erros} linha(s) com erro de leitura registradas.` : undefined,
          });
          setAnalise(null);
          setConteudo("");
          setNome(null);
        },
      });
    } catch (e) {
      toast.error("Não foi possível gravar", { description: mensagemAmigavel(e) });
    } finally {
      setGravando(false);
    }
  };

  const a = analise?.analise;
  const podeGravar =
    a !== undefined && a.registros.length > 0 && (!a.cabecalhoDivergente || aceitarDivergencia);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
          )}
        >
          <FileUp aria-hidden />
          Escolher arquivo
          <input
            type="file"
            accept=".csv,.txt"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void lerArquivo(f);
            }}
          />
        </label>
        {nome && <span className="font-mono text-xs text-muted-foreground">{nome}</span>}
      </div>
      <AreaDeTexto
        aria-label="Conteúdo do relatório"
        placeholder="…ou cole aqui o conteúdo do relatório"
        value={conteudo}
        onChange={(e) => {
          setConteudo(e.target.value);
          setAnalise(null);
        }}
      />
      <Button
        size="sm"
        variant={a ? "outline" : "default"}
        onClick={processar}
        disabled={conteudo.trim() === ""}
      >
        Processar
      </Button>

      {a && (
        <div className="space-y-3">
          {a.cabecalhoDivergente && (
            <Aviso tom="alerta" titulo="Cabeçalho diferente do esperado">
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {a.cabecalhoDiferencas.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <label className="mt-2 flex items-center gap-2 font-medium">
                <Checkbox
                  checked={aceitarDivergencia}
                  onCheckedChange={(v) => {
                    setAceitarDivergencia(v === true);
                  }}
                />
                Conferi o arquivo e quero gravar mesmo assim
              </label>
            </Aviso>
          )}
          <div className="flex flex-wrap gap-2">
            <SeloStatus tom="info" icone={FileText}>
              {a.registros.length} linha(s) lida(s)
            </SeloStatus>
            <SeloStatus tom={a.erros.length > 0 ? "erro" : "neutro"}>
              {a.erros.length} com erro
            </SeloStatus>
          </div>
          {a.erros.length > 0 && (
            <details className="group rounded-xl border border-border bg-card text-[13px]">
              <summary className="cursor-pointer rounded-xl px-3 py-2 font-medium hover:bg-muted/60">
                Ver linhas com erro
              </summary>
              <ul className="rolagem-fina max-h-60 space-y-1 overflow-auto border-t border-border px-3 py-2 font-mono text-xs text-status-bad-fg">
                {a.erros.slice(0, 500).map((e) => (
                  <li key={`${e.linha}-${e.motivo}`}>
                    Linha {e.linha}: {e.motivo}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {linhas.length > 0 && (
            <TabelaDados
              colunas={colunas}
              linhas={linhas}
              chaveDaLinha={(l) => String(l._linha)}
              porPagina={25}
              rotuloTotal={(n) => `${n} linha(s)`}
            />
          )}
          <Button size="sm" onClick={() => void gravar()} disabled={!podeGravar || gravando}>
            {gravando && <Loader2 className="motion-safe:animate-spin" aria-hidden />}
            Gravar na staging
          </Button>
        </div>
      )}
    </div>
  );
}
