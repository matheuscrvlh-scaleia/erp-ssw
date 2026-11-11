import { type ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/componentes/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/componentes/ui/sheet";
import { cn } from "@/lib/utils";

/** Larguras usadas hoje: detalhe de um item (560 px) e gaveta com lista (3xl). */
const LARGURA_GAVETA = { media: "sm:max-w-[560px]", larga: "sm:max-w-3xl" } as const;
const LARGURA_MODAL = { media: "sm:max-w-lg", larga: "sm:max-w-3xl" } as const;

interface DetalheProps {
  /** Aberto quando há item; fechar (Esc, X, fora) chama `aoFechar`. */
  aberto: boolean;
  aoFechar: () => void;
  titulo: ReactNode;
  /** Subtítulo; também é a descrição lida pelo leitor de tela. */
  descricao?: ReactNode;
  /** Ações à direita do título (ex.: ExportMenu). */
  acoes?: ReactNode;
  largura?: keyof typeof LARGURA_GAVETA | undefined;
  children: ReactNode;
}

function Cabecalho({ titulo, descricao, acoes, Titulo, Descricao }: CabecalhoProps) {
  return (
    <div className="flex items-start justify-between gap-3 pr-8">
      <div className="min-w-0">
        <Titulo className="text-[17px] font-bold">{titulo}</Titulo>
        {descricao ? (
          <Descricao className="text-[13px]">{descricao}</Descricao>
        ) : (
          <Descricao className="sr-only">Detalhe</Descricao>
        )}
      </div>
      {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
    </div>
  );
}

interface CabecalhoProps {
  titulo: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  // Sheet e Dialog são o mesmo Dialog do Radix: os componentes de título têm o mesmo tipo.
  Titulo: typeof SheetTitle;
  Descricao: typeof SheetDescription;
}

/** Gaveta lateral de detalhe (CT-e, coleta, lista aberta por um card). */
export function DrawerDetalhe({
  aberto,
  aoFechar,
  titulo,
  descricao,
  acoes,
  largura = "media",
  children,
}: DetalheProps) {
  return (
    <Sheet
      open={aberto}
      onOpenChange={(v) => {
        if (!v) aoFechar();
      }}
    >
      <SheetContent side="right" className={cn("w-full overflow-y-auto", LARGURA_GAVETA[largura])}>
        <SheetHeader>
          <Cabecalho
            titulo={titulo}
            descricao={descricao}
            acoes={acoes}
            Titulo={SheetTitle}
            Descricao={SheetDescription}
          />
        </SheetHeader>
        <div className="mt-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

/** Janela de detalhe no centro da tela. */
export function ModalDetalhe({
  aberto,
  aoFechar,
  titulo,
  descricao,
  acoes,
  largura = "media",
  children,
}: DetalheProps) {
  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (!v) aoFechar();
      }}
    >
      <DialogContent className={cn("max-h-[90vh] overflow-y-auto", LARGURA_MODAL[largura])}>
        <DialogHeader>
          <Cabecalho
            titulo={titulo}
            descricao={descricao}
            acoes={acoes}
            Titulo={DialogTitle}
            Descricao={DialogDescription}
          />
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** Grade de campos "rótulo / valor" do detalhe (duas colunas). */
export function GradeDetalhe({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</dl>;
}

/** Um campo do detalhe; vazio vira "—". */
export function CampoDetalhe({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div>
      <dt className="label-xs">{rotulo}</dt>
      <dd className="mt-1 text-[13.5px]">
        {valor === null || valor === undefined || valor === "" ? "—" : valor}
      </dd>
    </div>
  );
}
