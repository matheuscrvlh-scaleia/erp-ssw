import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PaginaProps {
  /** Nome da tela (h1). */
  titulo: ReactNode;
  /** Uma linha de contexto sob o título (ex.: "Entregas por unidade no período"). */
  descricao?: ReactNode;
  /** Informação de estado ao lado da descrição (ex.: `<SeloDosDados />`). */
  meta?: ReactNode;
  /** Ações da tela, sempre à direita do título: exportar, relatório, novo cadastro… */
  acoes?: ReactNode;
  /**
   * Barra de filtros: `<FiltrosAvancados>` (+ `<FiltrandoPor>`). Fica sempre logo abaixo do
   * cabeçalho e gruda no topo ao rolar (desktop), em todas as telas.
   */
  filtros?: ReactNode;
  /** Abas da tela, coladas no pé do cabeçalho. */
  abas?: ReactNode;
  /** `estreita` para formulários e cadastros simples (até 960 px). */
  largura?: "normal" | "estreita";
  className?: string | undefined;
  children: ReactNode;
}

/**
 * Molde de toda tela logada (docs/design/guia.md §Página): cabeçalho com título, contexto e
 * ações; barra de filtros fixa logo abaixo; conteúdo com o mesmo espaçamento em todas as telas.
 */
export function Pagina({
  titulo,
  descricao,
  meta,
  acoes,
  filtros,
  abas,
  largura = "normal",
  className,
  children,
}: PaginaProps) {
  const limite = largura === "estreita" ? "max-w-[960px]" : "max-w-[1600px]";
  return (
    <>
      <header className="border-b border-border bg-card">
        <div
          className={cn(
            "mx-auto flex w-full flex-wrap items-start gap-x-6 gap-y-3 px-4 pt-5 md:px-8 md:pt-6",
            abas ? "pb-0" : "pb-5",
            limite,
          )}
        >
          {/* Base de 18rem: sem espaço para título + ações, as ações descem para a linha de baixo. */}
          <div className="min-w-0 flex-[1_1_18rem]">
            <h1 className="text-[22px] leading-tight font-bold tracking-[-0.02em] text-foreground md:text-[24px]">
              {titulo}
            </h1>
            {(descricao ?? meta) && (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-muted-foreground">
                {descricao && <span>{descricao}</span>}
                {meta}
              </div>
            )}
          </div>
          {acoes && (
            <div className="flex flex-wrap items-center gap-2" data-exportacao-ignorar>
              {acoes}
            </div>
          )}
          {abas && <div className="-mb-px w-full pt-1">{abas}</div>}
        </div>
      </header>
      {filtros && (
        <div className="z-20 border-b border-border bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75 md:sticky md:top-0">
          <div className={cn("mx-auto w-full space-y-2 px-4 py-3 md:px-8", limite)}>{filtros}</div>
        </div>
      )}
      <div
        className={cn(
          "mx-auto w-full space-y-5 px-4 py-5 md:space-y-6 md:px-8 md:py-6",
          limite,
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}

/** Bloco com título dentro da página (agrupa cartões, gráficos ou uma tabela). */
export function Secao({
  titulo,
  descricao,
  acoes,
  className,
  children,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold tracking-[-0.01em] text-foreground">{titulo}</h2>
          {descricao && <p className="mt-0.5 text-[13px] text-muted-foreground">{descricao}</p>}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>
      {children}
    </section>
  );
}
