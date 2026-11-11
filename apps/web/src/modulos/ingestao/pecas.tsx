/** Peças visuais das telas de ingestão (item recolhível, barra de progresso, selo, confirmação). */
import {
  ChevronDown,
  CircleMinus,
  Clock,
  Copy,
  type LucideIcon,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import { SeloStatus, type Tom } from "@/componentes/comum/SeloStatus";
import { Button } from "@/componentes/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/componentes/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Item recolhível (o "accordion" da tela atual), com `<details>` nativo: teclado e leitor de
 * tela. Use em lista dentro de um `Painel` (as bordas entre itens vêm do `divide-y` do pai).
 */
export function ItemRecolhivel({
  titulo,
  icone: Icone,
  children,
}: {
  titulo: ReactNode;
  icone?: LucideIcon | undefined;
  children: ReactNode;
}) {
  return (
    <details className="group">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-5 py-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
        {Icone && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-brand">
            <Icone className="h-4 w-4" aria-hidden />
          </span>
        )}
        <span className="min-w-0 flex-1">{titulo}</span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-border bg-background/40 px-5 py-4">{children}</div>
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
      <div
        className="h-full rounded-full bg-primary motion-safe:transition-[width]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Situação de ciclo, arquivo, aplicação, sincronização ou XML → tom e ícone do selo. */
const SITUACAO: Record<string, { tom: Tom; icone?: LucideIcon }> = {
  aplicado: { tom: "sucesso" },
  importado: { tom: "sucesso" },
  sucesso: { tom: "sucesso" },
  ok: { tom: "sucesso" },
  concluido: { tom: "sucesso" },
  aplicando: { tom: "info", icone: RefreshCw },
  importando: { tom: "info", icone: RefreshCw },
  em_andamento: { tom: "info", icone: RefreshCw },
  processando: { tom: "info", icone: RefreshCw },
  aguardando: { tom: "info", icone: Clock },
  pendente: { tom: "info", icone: Clock },
  aberto: { tom: "neutro" },
  parcial: { tom: "alerta" },
  pausado: { tom: "alerta" },
  duplicado: { tom: "neutro", icone: Copy },
  ignorado: { tom: "neutro", icone: CircleMinus },
  descartado: { tom: "neutro", icone: Trash2 },
  erro: { tom: "erro" },
};

/** Selo da situação como vem da API ("em_andamento" → "em andamento"), com ícone + texto. */
export function SeloDaSituacao({ status }: { status: string }) {
  const s = SITUACAO[status] ?? { tom: "neutro" };
  return (
    <SeloStatus tom={s.tom} icone={s.icone}>
      {status.replace(/_/g, " ")}
    </SeloStatus>
  );
}

export function AreaDeTexto(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-[120px] w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs text-foreground shadow-cartao placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        props.className,
      )}
    />
  );
}

/**
 * Confirmação de ação perigosa: título com a pergunta, consequência na descrição, botão
 * destrutivo com o verbo da ação. `motivo` pede um texto obrigatório antes de confirmar.
 */
export function ConfirmarAcao({
  aberto,
  aoMudarAberto,
  titulo,
  descricao,
  rotuloDoBotao,
  motivo,
  aoConfirmar,
}: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  titulo: ReactNode;
  descricao: ReactNode;
  rotuloDoBotao: string;
  /** Rótulo do campo de motivo (obrigatório quando informado). */
  motivo?: string | undefined;
  aoConfirmar: (motivo: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const podeConfirmar = motivo === undefined || texto.trim() !== "";
  const fechar = (v: boolean) => {
    if (!v) setTexto("");
    aoMudarAberto(v);
  };
  return (
    <Dialog open={aberto} onOpenChange={fechar}>
      <DialogContent className="max-w-md">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!podeConfirmar) return;
            aoConfirmar(texto.trim());
            fechar(false);
          }}
        >
          <DialogHeader>
            <DialogTitle className="pr-6 text-[16px] font-bold">{titulo}</DialogTitle>
            <DialogDescription className="text-[13px]">{descricao}</DialogDescription>
          </DialogHeader>
          {motivo !== undefined && (
            <label className="block space-y-1.5 text-[13px] font-medium text-foreground">
              {motivo}
              <AreaDeTexto
                autoFocus
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value);
                }}
                maxLength={500}
                className="min-h-[88px] font-sans text-[13px]"
              />
            </label>
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                fechar(false);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" size="sm" disabled={!podeConfirmar}>
              {rotuloDoBotao}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
