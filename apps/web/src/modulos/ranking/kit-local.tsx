// TODO(kit-ui): o kit comum (docs/kit-ui.md) ainda não tem abas nem o botão "Como funciona".
// Mesmas classes do sistema atual; trocar pelos do kit quando chegarem e apagar este arquivo.
import { Info } from "lucide-react";
import { createContext, type ReactNode, useContext, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/componentes/ui/dialog";
import { cn } from "@/lib/utils";

/* ---------- Abas (Tabs do shadcn) ---------- */

const AbaAtiva = createContext<{ valor: string; mudar: (v: string) => void }>({
  valor: "",
  mudar: () => undefined,
});

export function Abas({
  padrao,
  className,
  children,
}: {
  padrao: string;
  className?: string;
  children: ReactNode;
}) {
  const [valor, mudar] = useState(padrao);
  return (
    <AbaAtiva.Provider value={{ valor, mudar }}>
      <div className={className}>{children}</div>
    </AbaAtiva.Provider>
  );
}

export function ListaDeAbas({ children }: { children: ReactNode }) {
  return (
    <div
      role="tablist"
      className="inline-flex h-9 w-max items-center justify-center whitespace-nowrap rounded-lg bg-muted p-1 text-muted-foreground"
    >
      {children}
    </div>
  );
}

export function Aba({
  valor,
  className,
  children,
}: {
  valor: string;
  className?: string;
  children: ReactNode;
}) {
  const atual = useContext(AbaAtiva);
  const ativa = atual.valor === valor;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativa}
      onClick={() => {
        atual.mudar(valor);
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium transition-all",
        ativa && "bg-background text-foreground shadow",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ConteudoDaAba({
  valor,
  className,
  children,
}: {
  valor: string;
  className?: string;
  children: ReactNode;
}) {
  const atual = useContext(AbaAtiva);
  if (atual.valor !== valor) return null;
  return (
    <div role="tabpanel" className={cn("mt-2", className)}>
      {children}
    </div>
  );
}

/* ---------- "Como funciona" ---------- */

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
          className="group inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 py-0.5 pl-0.5 pr-2.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
        >
          <span className="relative flex h-5 w-5 items-center justify-center">
            {!visto && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40" />
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
          <DialogDescription className="text-[12px]">{resumo}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-[12px] leading-relaxed">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export function ComoFuncionaSecao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[13px] font-semibold">{titulo}</h3>
      <div className="space-y-1.5 text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

export function Formula({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 font-mono text-[11px] text-foreground">
      {children}
    </div>
  );
}
