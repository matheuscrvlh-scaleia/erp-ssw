/**
 * Busca por NF ou CT-e com espera de 400 ms (Enter aplica na hora). Aceita o número com ou sem
 * série e com ou sem dígito ("020642", "CAP020642-3").
 * origem: BuscaDocumentoInput.tsx (sistema atual)
 */
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export function BuscaDocumento({
  valor,
  aoMudar,
  placeholder,
  className,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [local, setLocal] = useState(valor);
  const [valorVisto, setValorVisto] = useState(valor);
  if (valorVisto !== valor) {
    setValorVisto(valor);
    setLocal(valor);
  }

  useEffect(() => {
    const relogio = setTimeout(() => {
      if (local.trim() !== valor.trim()) aoMudar(local.trim());
    }, 400);
    return () => {
      clearTimeout(relogio);
    };
  }, [local, valor, aoMudar]);

  return (
    <div className={cn("relative w-[190px]", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") aoMudar(local.trim());
        }}
        placeholder={placeholder}
        aria-label={`Buscar por ${placeholder.replace(/\.+$/, "")}`}
        className="h-9 w-full rounded-lg border border-border bg-card pr-8 pl-9 text-[13px] shadow-cartao outline-none placeholder:text-muted-foreground focus:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      {local.length > 0 && (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => {
            setLocal("");
            aoMudar("");
          }}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
