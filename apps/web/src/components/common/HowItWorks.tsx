import { Info } from "lucide-react";
import { type ReactNode, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/*
 * Botão "Como funciona" e o texto da explicação da página (seções e fórmulas), no desenho do
 * sistema atual. O conteúdo é de cada tela.
 */

/** Botão "i" que abre a explicação da página; pulsa até a pessoa abrir pela primeira vez. */
export function ComoFunciona({
  chave,
  titulo,
  resumo,
  children,
}: {
  chave: string;
  titulo: string;
  resumo: string;
  children: ReactNode;
}) {
  const chaveDoStorage = `como-funciona:${chave}`;
  const [visto, setVisto] = useState(() => {
    try {
      return window.localStorage.getItem(chaveDoStorage) === "1";
    } catch {
      return false;
    }
  });
  const aoAbrir = (aberto: boolean) => {
    if (!aberto || visto) return;
    setVisto(true);
    try {
      window.localStorage.setItem(chaveDoStorage, "1");
    } catch {
      // Sem storage o botão só continua pulsando.
    }
  };
  return (
    <Dialog onOpenChange={aoAbrir}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Como funciona: ${titulo}`}
          className="group inline-flex h-8 items-center gap-1.5 rounded-full border border-brand/30 bg-brand-suave py-0.5 pr-3 pl-1 text-[12.5px] font-semibold text-brand transition-colors hover:border-brand/60"
        >
          <span className="relative flex h-5 w-5 items-center justify-center">
            {!visto && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary/40 motion-safe:animate-ping" />
            )}
            <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Info className="h-3.5 w-3.5" />
            </span>
          </span>
          Como funciona
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription className="text-[13px]">{resumo}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 text-[13px] leading-relaxed">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export function ComoFuncionaSecao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[14px] font-bold">{titulo}</h3>
      <div className="space-y-1.5 text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

export function Formula({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted px-3 py-2 font-mono text-[12px] text-foreground">
      {children}
    </div>
  );
}
