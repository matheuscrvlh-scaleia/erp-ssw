import { X } from "lucide-react";
import { type ReactNode } from "react";

import { Button } from "@/componentes/ui/button";
import { cn } from "@/lib/utils";

export interface FiltrosAvancadosProps {
  /** FiltroPeriodo, FiltroMultiplo, FiltroTexto... na ordem da tela. */
  children: ReactNode;
  /** Com algum filtro ligado, aparece "Limpar filtros". */
  ativos?: boolean | undefined;
  aoLimpar?: (() => void) | undefined;
  className?: string | undefined;
}

/** Barra de filtros das telas (cartão com os seletores lado a lado e "Limpar filtros"). */
export function FiltrosAvancados({ children, ativos, aoLimpar, className }: FiltrosAvancadosProps) {
  return (
    <div
      role="group"
      aria-label="Filtros"
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-[10px] border border-border/70 bg-card p-2",
        className,
      )}
    >
      {children}
      {ativos && aoLimpar && (
        <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={aoLimpar}>
          Limpar filtros
        </Button>
      )}
    </div>
  );
}

/** Um filtro ativo na faixa "Filtrando por". */
export interface EtiquetaFiltro {
  rotulo: string;
  valor: string;
  /** Texto completo para a dica (ex.: lista inteira quando `valor` foi resumido). */
  completo?: string | undefined;
  /** Tira esse filtro; sem ele, a etiqueta não tem o "x". */
  limpar?: (() => void) | undefined;
}

/**
 * Etiqueta montada pela regra pura da tela: `limpar` diz quais campos da busca voltam ao padrão.
 * A tela liga ao `definir` da URL com `etiquetasQueLimpam`.
 */
export type EtiquetaDaBusca<B> = Omit<EtiquetaFiltro, "limpar"> & { limpar: Partial<B> };

/** Liga cada etiqueta ao `definir` da tela: o "x" tira aquele filtro da URL. */
export function etiquetasQueLimpam<B>(
  etiquetas: readonly EtiquetaDaBusca<B>[],
  definir: (mudanca: Partial<B>) => void,
): EtiquetaFiltro[] {
  return etiquetas.map((e) => ({
    ...e,
    limpar: () => {
      definir(e.limpar);
    },
  }));
}

/** `false`/`null`/`""` são ignorados: monte a lista com `cond && {...}`. */
export type EtiquetaFiltroOpcional = EtiquetaFiltro | false | null | undefined | "";

/** Até `max` nomes e o resto como "+N"; a lista completa vai na dica. */
export function resumirNomes(
  nomes: readonly string[],
  max = 3,
): Pick<EtiquetaFiltro, "valor" | "completo"> {
  return {
    valor:
      nomes.length > max
        ? `${nomes.slice(0, max).join(" · ")} +${String(nomes.length - max)}`
        : nomes.join(" · "),
    completo: nomes.join("\n"),
  };
}

/**
 * Faixa "Filtrando por": com qualquer filtro ligado, mostra em destaque o que está recortando os
 * números. Não aparece sem filtro. Período não entra (já está visível nos botões).
 * origem: components/common/FiltrandoPor.tsx (sistema atual)
 */
export function FiltrandoPor({
  etiquetas,
  className,
}: {
  etiquetas: readonly EtiquetaFiltroOpcional[];
  className?: string | undefined;
}) {
  const ativas = etiquetas.filter((e): e is EtiquetaFiltro => Boolean(e && e.valor));
  if (ativas.length === 0) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-[10px] border border-[var(--brand)]/40 bg-[var(--brand)]/5 px-3 py-2.5",
        className,
      )}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Filtrando por
      </span>
      {ativas.map((e) => (
        <span
          key={e.rotulo}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--brand)]/60 bg-card py-1 pl-3 pr-1.5 text-[15px]"
        >
          <span className="shrink-0 text-muted-foreground">{e.rotulo}:</span>
          <span className="truncate font-semibold text-foreground" title={e.completo ?? e.valor}>
            {e.valor}
          </span>
          {e.limpar ? (
            <button
              type="button"
              onClick={e.limpar}
              data-exportacao-ignorar
              title={`Tirar o filtro de ${e.rotulo.toLowerCase()}`}
              aria-label={`Tirar o filtro de ${e.rotulo.toLowerCase()}`}
              className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : (
            <span className="pr-1.5" />
          )}
        </span>
      ))}
    </div>
  );
}
