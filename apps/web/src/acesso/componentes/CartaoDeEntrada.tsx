import { type ReactNode } from "react";

/** Moldura das telas fora do painel (login, nova senha, convite): mesma marca e espaçamento. */
export function CartaoDeEntrada({
  titulo,
  subtitulo,
  aviso,
  children,
}: {
  titulo: string;
  subtitulo: string;
  aviso?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-[10px] border border-border bg-card p-6">
        {aviso}
        <div className="mb-6">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--brand)] text-[13px] font-medium text-white">
              BI
            </div>
            <span className="text-[15px] font-medium tracking-tight">Painel BI</span>
          </div>
          <h1
            className="text-[20px] font-medium text-foreground"
            style={{ letterSpacing: "-0.02em" }}
          >
            {titulo}
          </h1>
          <p className="mt-1 text-[12px] text-muted-foreground">{subtitulo}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErroDoCampo({ mensagem }: { mensagem: string | undefined }) {
  if (!mensagem) return null;
  return <p className="mt-1 text-[11px] text-destructive">{mensagem}</p>;
}
