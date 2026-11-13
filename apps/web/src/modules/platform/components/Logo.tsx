import { type EmpresaCompleta } from "@erp/shared/contracts/platform";
import { useQueryClient } from "@tanstack/react-query";
import { ImageUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useGravacao } from "@/hooks/use-save";
import { cn } from "@/lib/utils";

import { mutacaoEnviarLogo, mutacaoRemoverLogo } from "../api";

export function Logo({ empresa }: { empresa: EmpresaCompleta }) {
  const cliente = useQueryClient();
  const envio = useGravacao({
    mutacao: mutacaoEnviarLogo(cliente, empresa.id),
    sucesso: "Logo enviado",
  });
  const remocao = useGravacao({
    mutacao: mutacaoRemoverLogo(cliente, empresa.id),
    sucesso: "Logo removido",
  });
  const ocupado = envio.gravando || remocao.gravando;

  return (
    <div className="space-y-1.5">
      <span className="block text-[13px] font-medium">Logo</span>
      <div className="flex flex-wrap items-center gap-3">
        {empresa.logoUrl ? (
          <img
            src={empresa.logoUrl}
            alt={`Logo de ${empresa.nome}`}
            className="h-14 w-14 rounded-xl border border-border object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
            sem logo
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
            {envio.gravando ? "Enviando…" : empresa.logoUrl ? "Trocar logo" : "Enviar logo"}
          </label>
        </Button>
        {empresa.logoUrl && (
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
      <p className="text-xs text-muted-foreground">
        PNG ou JPEG até 512 KB, de preferência quadrado. Sai no menu e nos PDFs, planilhas e
        impressões da empresa.
      </p>
    </div>
  );
}
