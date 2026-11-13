import { type EmpresaCompleta } from "@erp/shared/contracts/platform";
import { useQueryClient } from "@tanstack/react-query";
import { ImageUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useGravacao } from "@/hooks/use-save";
import { cn } from "@/lib/utils";

import { type ImagemDaMarca as Imagem, mutacaoEnviarImagem, mutacaoRemoverImagem } from "../api";

const TEXTOS: Record<Imagem, { rotulo: string; ajuda: string; tamanho: string }> = {
  logo: {
    rotulo: "Logo",
    ajuda:
      "PNG ou JPEG até 512 KB, de preferência quadrado. Sai no menu e nos PDFs, planilhas e impressões da empresa.",
    tamanho: "h-14 w-14",
  },
  favicon: {
    rotulo: "Favicon",
    ajuda:
      "Ícone da aba do navegador. PNG ou JPEG quadrado (32×32 ou 64×64), até 512 KB. Sem favicon, vale o do sistema.",
    tamanho: "h-10 w-10",
  },
};

/** Envio, troca e remoção do logo ou do favicon da empresa. */
export function ImagemDaMarca({ empresa, imagem }: { empresa: EmpresaCompleta; imagem: Imagem }) {
  const cliente = useQueryClient();
  const { rotulo, ajuda, tamanho } = TEXTOS[imagem];
  const url = imagem === "logo" ? empresa.logoUrl : empresa.faviconUrl;
  const envio = useGravacao({
    mutacao: mutacaoEnviarImagem(cliente, empresa.id, imagem),
    sucesso: `${rotulo} enviado`,
  });
  const remocao = useGravacao({
    mutacao: mutacaoRemoverImagem(cliente, empresa.id, imagem),
    sucesso: `${rotulo} removido`,
  });
  const ocupado = envio.gravando || remocao.gravando;

  return (
    <div className="space-y-1.5">
      <span className="block text-[13px] font-medium">{rotulo}</span>
      <div className="flex flex-wrap items-center gap-3">
        {url ? (
          <img
            src={url}
            alt={`${rotulo} de ${empresa.nome}`}
            className={cn(tamanho, "rounded-xl border border-border object-cover")}
          />
        ) : (
          <div
            className={cn(
              tamanho,
              "flex items-center justify-center rounded-xl border border-dashed border-border text-center text-[10px] leading-tight text-muted-foreground",
            )}
          >
            sem {rotulo.toLowerCase()}
          </div>
        )}
        <Button
          asChild
          size="sm"
          variant="outline"
          className="focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring"
        >
          <label className={cn(ocupado && "pointer-events-none opacity-50")}>
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              disabled={ocupado}
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (arquivo) void envio.gravar(arquivo);
              }}
            />
            <ImageUp aria-hidden />
            {envio.gravando
              ? "Enviando…"
              : url
                ? `Trocar ${rotulo.toLowerCase()}`
                : `Enviar ${rotulo.toLowerCase()}`}
          </label>
        </Button>
        {url && (
          <Button
            variant="ghost"
            size="sm"
            disabled={ocupado}
            onClick={() => void remocao.gravar(undefined)}
          >
            Remover
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{ajuda}</p>
    </div>
  );
}
