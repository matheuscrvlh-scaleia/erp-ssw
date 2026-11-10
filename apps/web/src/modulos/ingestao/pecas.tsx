/** Peças visuais das telas de ingestão (cartão, seção recolhível, barra de progresso, abas, selo). */
import { ChevronDown } from "lucide-react";
import { type ReactNode } from "react";

import { Badge } from "@/componentes/ui/badge";
import { cn } from "@/lib/utils";

export function Cartao({
  titulo,
  descricao,
  acoes,
  children,
  className,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="text-[15px] font-semibold">{titulo}</h2>
          {descricao && <p className="text-[12px] text-muted-foreground">{descricao}</p>}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </header>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  );
}

/** Item recolhível (o "accordion" da tela atual), com `<details>` nativo: teclado e leitor de tela. */
export function Secao({ titulo, children }: { titulo: ReactNode; children: ReactNode }) {
  return (
    <details className="group rounded-md border">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[13px] font-medium hover:bg-muted/50">
        {titulo}
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t p-4">{children}</div>
    </details>
  );
}

export function BarraDeProgresso({ valor, rotulo }: { valor: number; rotulo: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(valor * 100)));
  return (
    <div
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Abas<T extends string>({
  abas,
  ativa,
  aoMudar,
}: {
  abas: readonly { valor: T; rotulo: string }[];
  ativa: T;
  aoMudar: (v: T) => void;
}) {
  return (
    <div role="tablist" className="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1">
      {abas.map((a) => (
        <button
          key={a.valor}
          type="button"
          role="tab"
          aria-selected={a.valor === ativa}
          onClick={() => {
            aoMudar(a.valor);
          }}
          className={cn(
            "rounded px-3 py-1 text-[12px]",
            a.valor === ativa ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
          )}
        >
          {a.rotulo}
        </button>
      ))}
    </div>
  );
}

const COR_DO_STATUS: Record<string, string> = {
  aplicado: "bg-emerald-600 text-white",
  importado: "bg-emerald-600 text-white",
  sucesso: "bg-emerald-600 text-white",
  ok: "bg-emerald-600 text-white",
  concluido: "bg-emerald-600 text-white",
  aplicando: "bg-sky-600 text-white",
  importando: "bg-sky-600 text-white",
  em_andamento: "bg-sky-600 text-white",
  aberto: "bg-slate-500 text-white",
  parcial: "bg-amber-500 text-white",
  pausado: "bg-amber-500 text-white",
  duplicado: "bg-slate-400 text-white",
  ignorado: "bg-slate-400 text-white",
  descartado: "bg-slate-400 text-white",
  erro: "bg-red-600 text-white",
};

export function SeloStatus({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", COR_DO_STATUS[status])}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

export function AreaDeTexto(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-[120px] w-full rounded-md border bg-background px-3 py-2 font-mono text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        props.className,
      )}
    />
  );
}
