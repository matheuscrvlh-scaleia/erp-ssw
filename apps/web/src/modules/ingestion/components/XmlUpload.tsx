/** Upload manual de XML de CT-e (.xml ou .zip, até 50 por vez), com o resultado de cada arquivo. */
import { type ResultadoDoXml } from "@erp/shared/contracts/ingestion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { TabelaDados } from "@/components/common/DataTable";
import { SeloDaSituacao } from "@/components/common/SituationBadge";
import { cn } from "@/lib/utils";

import { mutacaoImportarXml } from "../api";
import { BarraDeProgresso } from "./ProgressBar";

const MAX_ARQUIVOS = 50;

export function UploadXml() {
  const queryClient = useQueryClient();
  const importarXml = useMutation(mutacaoImportarXml(queryClient));
  const [enviando, setEnviando] = useState<{ atual: number; total: number } | null>(null);
  const [resultados, setResultados] = useState<ResultadoDoXml[]>([]);
  const [arrastando, setArrastando] = useState(false);

  const enviar = async (lista: File[]) => {
    const validos = lista.filter((f) => /\.(xml|zip)$/i.test(f.name));
    if (validos.length === 0) {
      toast.error("Envie arquivos .xml ou .zip.");
      return;
    }
    if (validos.length > MAX_ARQUIVOS) {
      toast.error(`Envie no máximo ${MAX_ARQUIVOS} arquivos por vez.`);
      return;
    }
    await importarXml.mutateAsync({
      arquivos: validos,
      aoEnviar: (atual, total) => {
        setEnviando({ atual, total });
      },
      aoReceber: setResultados,
      aoConcluir: () => {
        setEnviando(null);
      },
    });
  };

  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => {
          setArrastando(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          void enviar([...e.dataTransfer.files]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center text-[13px] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
          arrastando
            ? "border-brand bg-brand-suave text-foreground"
            : "border-border text-muted-foreground hover:border-brand/50 hover:bg-muted/50",
          enviando !== null && "pointer-events-none opacity-60",
        )}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-brand shadow-cartao">
          <Upload className="h-5 w-5" aria-hidden />
        </span>
        Arraste os arquivos .xml ou .zip aqui, ou clique para escolher (até {MAX_ARQUIVOS})
        <input
          type="file"
          multiple
          accept=".xml,.zip"
          className="sr-only"
          disabled={enviando !== null}
          onChange={(e) => void enviar([...(e.target.files ?? [])])}
        />
      </label>
      {enviando && (
        <div role="status" className="space-y-1.5 text-[13px]">
          <p className="font-medium">
            Enviando {enviando.atual} de {enviando.total}…
          </p>
          <BarraDeProgresso
            valor={(enviando.atual - 1) / enviando.total}
            rotulo="Envio dos arquivos"
          />
        </div>
      )}
      {resultados.length > 0 && (
        <TabelaDados
          titulo="Última importação"
          colunas={[
            { chave: "arquivo", titulo: "Arquivo", classe: "font-mono max-w-[300px] truncate" },
            {
              chave: "status",
              titulo: "Situação",
              celula: (r) => <SeloDaSituacao status={r.status} />,
              valor: (r) => r.status,
            },
            { chave: "ctesProcessados", titulo: "CT-e", formato: "inteiro" },
            { chave: "cancelamentos", titulo: "Cancelamentos", formato: "inteiro" },
            { chave: "orfaos", titulo: "Órfãos", formato: "inteiro" },
            { chave: "pulados", titulo: "Já importados", formato: "inteiro" },
            {
              chave: "erros",
              titulo: "Erros",
              valor: (r) => r.erros.map((e) => `${e.nome}: ${e.erro}`).join("; "),
              classe: "max-w-[320px] truncate",
            },
          ]}
          linhas={resultados}
          chaveDaLinha={(r) => r.arquivo}
          porPagina={0}
        />
      )}
    </div>
  );
}
