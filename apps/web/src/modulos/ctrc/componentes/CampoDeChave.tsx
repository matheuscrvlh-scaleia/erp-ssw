import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { formatarChave } from "../textos";
import { Campo } from "./Campo";

export function CampoDeChave({ rotulo, chave }: { rotulo: string; chave: string }) {
  const [copiou, setCopiou] = useState(false);
  return (
    <Campo rotulo={rotulo} largo>
      <span className="flex items-start gap-2">
        <span className="font-mono text-[12.5px] leading-relaxed break-all">
          {formatarChave(chave)}
        </span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(chave.replace(/\D/g, "")).then(() => {
              setCopiou(true);
              setTimeout(() => {
                setCopiou(false);
              }, 1500);
            });
          }}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Copiar chave"
          title="Copiar"
        >
          {copiou ? (
            <Check className="h-3.5 w-3.5 text-status-good-fg" aria-hidden />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
      </span>
    </Campo>
  );
}
