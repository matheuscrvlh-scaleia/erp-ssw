/**
 * Importador manual de um relatório SSW: arquivo (latin-1) ou texto colado → "Processar" mostra a
 * prévia lida aqui no navegador (mesmo leitor do servidor) → "Gravar na staging".
 */
import { lerRelatorio, type Relatorio } from "@erp/dominio/ingestao/relatorios";
import { contratosIngestao as c } from "@erp/shared/contratos/ingestao";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileUp, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { Badge } from "@/componentes/ui/badge";
import { Button } from "@/componentes/ui/button";
import { Checkbox } from "@/componentes/ui/checkbox";
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";

import { CHAVE_DA_INGESTAO } from "./api";
import { AreaDeTexto } from "./pecas";

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
      const r = await chamar(c.importarRelatorio, {
        entrada: { relatorio, conteudo, nome, aceitarDivergencia },
      });
      toast.success(`${r.gravados} linha(s) gravada(s) na staging`, {
        description:
          r.erros > 0 ? `${r.erros} linha(s) com erro de leitura registradas.` : undefined,
      });
      setAnalise(null);
      setConteudo("");
      setNome(null);
      await queryClient.invalidateQueries({ queryKey: CHAVE_DA_INGESTAO });
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
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-[12px] hover:bg-muted">
          <FileUp className="h-4 w-4" aria-hidden />
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
        {nome && <span className="text-[12px] text-muted-foreground">{nome}</span>}
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
      <Button size="sm" onClick={processar} disabled={conteudo.trim() === ""}>
        Processar
      </Button>

      {a && (
        <div className="space-y-3">
          {a.cabecalhoDivergente && (
            <div
              role="alert"
              className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-900"
            >
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" aria-hidden /> Cabeçalho diferente do esperado
              </p>
              <ul className="list-disc pl-5">
                {a.cabecalhoDiferencas.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={aceitarDivergencia}
                  onCheckedChange={(v) => {
                    setAceitarDivergencia(v === true);
                  }}
                />
                Conferi o arquivo e quero gravar mesmo assim
              </label>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{a.registros.length} linha(s) lida(s)</Badge>
            <Badge variant={a.erros.length > 0 ? "destructive" : "outline"}>
              {a.erros.length} com erro
            </Badge>
          </div>
          {a.erros.length > 0 && (
            <details className="rounded-md border p-2 text-[12px]">
              <summary className="cursor-pointer">Ver linhas com erro</summary>
              <ul className="mt-2 max-h-60 space-y-1 overflow-auto font-mono">
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
            {gravando && <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />}
            Gravar na staging
          </Button>
        </div>
      )}
    </div>
  );
}
