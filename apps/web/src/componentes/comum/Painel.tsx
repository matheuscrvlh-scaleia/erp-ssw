import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PainelProps {
  /** Rótulo em caixa alta ("PERFORMANCE POR UNIDADE"). */
  rotulo?: ReactNode;
  /** Título ou número de destaque sob o rótulo. */
  titulo?: ReactNode;
  /** Linha de apoio sob o título. */
  descricao?: ReactNode;
  /** Ícone no quadrado do canto (identidade do bloco, na cor da marca). */
  icone?: LucideIcon | undefined;
  /** Ações à direita do cabeçalho (exportar, menu, alternar visão). */
  acoes?: ReactNode;
  /**
   * Faixa entre o cabeçalho e o corpo, na moldura (seletores do gráfico à esquerda, legenda à
   * direita — como no mockup do dashboard).
   */
  barra?: ReactNode;
  /** Rodapé na moldura (comparação, link "ver lista →"). */
  rodape?: ReactNode;
  /** Classes do corpo (padrão: sem padding, para tabela/gráfico ocuparem a largura). */
  classeDoCorpo?: string | undefined;
  className?: string | undefined;
  children?: ReactNode;
}

/**
 * Cartão do painel no desenho do mockup: moldura cinza-clara com o conteúdo num cartão branco
 * dentro (cabeçalho, faixa de controles, corpo e rodapé). Use para gráficos, tabelas e blocos.
 */
export function Painel({
  rotulo,
  titulo,
  descricao,
  icone: Icone,
  acoes,
  barra,
  rodape,
  classeDoCorpo,
  className,
  children,
}: PainelProps) {
  const temCabecalho = Boolean(rotulo ?? titulo ?? descricao ?? Icone ?? acoes);
  const cabecalho = temCabecalho && (
    <div className="flex items-start gap-3 px-5 py-4">
      <div className="min-w-0 flex-1">
        {rotulo && <div className="label-xs">{rotulo}</div>}
        {titulo && (
          <div
            className={cn(
              "font-bold text-foreground",
              rotulo ? "mt-1.5 text-[18px] tracking-[-0.01em]" : "text-[15px]",
            )}
          >
            {titulo}
          </div>
        )}
        {descricao && <div className="mt-1 text-[13px] text-muted-foreground">{descricao}</div>}
      </div>
      {acoes && (
        <div className="flex shrink-0 flex-wrap items-center gap-2" data-exportacao-ignorar>
          {acoes}
        </div>
      )}
      {Icone && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-brand shadow-cartao">
          <Icone className="h-5 w-5" aria-hidden />
        </span>
      )}
    </div>
  );
  const corpo = children != null && <div className={classeDoCorpo}>{children}</div>;

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-2xl border border-border bg-superficie p-1 shadow-cartao",
        className,
      )}
    >
      {barra ? (
        <>
          {cabecalho && <div className="rounded-xl border border-border bg-card">{cabecalho}</div>}
          <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">{barra}</div>
          {corpo && (
            <div className="min-w-0 flex-1 rounded-xl border border-border bg-card">{corpo}</div>
          )}
        </>
      ) : (
        <div className="min-w-0 flex-1 rounded-xl border border-border bg-card">
          {cabecalho}
          {cabecalho && corpo && <div className="border-t border-border" />}
          {corpo}
        </div>
      )}
      {rodape && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[13px] text-muted-foreground">
          {rodape}
        </div>
      )}
    </section>
  );
}

/** Legenda de série para a `barra` do Painel ("■ Período atual  ■ Período anterior"). */
export function ItemDeLegenda({ cor, children }: { cor: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-foreground">
      <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: cor }} />
      {children}
    </span>
  );
}
