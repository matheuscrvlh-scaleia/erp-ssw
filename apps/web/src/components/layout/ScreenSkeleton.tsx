import { Skeleton } from "@/components/ui/skeleton";

const ESCURO = "bg-white/10";

/** Cartão de KPI vazio, com a mesma moldura do `KpiCard`. */
function CartaoVazio() {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-superficie p-1 shadow-cartao">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card px-4 py-3.5">
        <div className="flex items-start justify-between">
          <Skeleton className="mt-1 h-3 w-32" />
          <Skeleton className="size-10 rounded-full" />
        </div>
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="space-y-2 px-4 py-3.5">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

/** Painel vazio, com a moldura dos painéis de gráfico e tabela. */
function PainelVazio({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card p-6 shadow-cartao ${className ?? ""}`}
    >
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-3 h-6 w-72 max-w-full" />
      <Skeleton className="mt-6 h-3 w-full rounded-full" />
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-11 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/**
 * A tela logada enquanto o acesso carrega (logo depois do login): a barra lateral, o cabeçalho, os
 * filtros, os cartões e os painéis no lugar em que vão aparecer, como no Copiloto RH.
 */
export function EsqueletoDaTela() {
  return (
    <div role="status" aria-label="Carregando" className="flex min-h-svh bg-background">
      <aside className="sticky top-0 hidden h-svh w-[17rem] shrink-0 p-2 md:block">
        <div className="flex h-full flex-col gap-3 rounded-2xl bg-sidebar p-4 shadow-flutuante">
          <div className="flex items-center gap-3">
            <Skeleton className={`size-10 rounded-xl ${ESCURO}`} />
            <div className="flex-1 space-y-2">
              <Skeleton className={`h-4 w-32 ${ESCURO}`} />
              <Skeleton className={`h-3 w-20 ${ESCURO}`} />
            </div>
          </div>
          <Skeleton className={`mt-3 h-11 rounded-xl ${ESCURO}`} />
          <Skeleton className={`mt-4 h-3 w-24 ${ESCURO}`} />
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className={`h-9 rounded-lg ${ESCURO}`} />
          ))}
          <Skeleton className={`mt-auto h-14 rounded-xl ${ESCURO}`} />
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-start justify-between gap-4 px-4 pt-5 pb-5 md:px-8 md:pt-6">
          <div className="space-y-2.5">
            <Skeleton className="h-8 w-72 max-w-[70vw]" />
            <Skeleton className="h-4 w-96 max-w-[80vw]" />
          </div>
          <div className="hidden gap-2 lg:flex">
            <Skeleton className="h-10 w-40 rounded-full" />
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-10 w-48 rounded-lg" />
          </div>
        </div>
        <div className="border-b border-border">
          <div className="mx-auto flex w-full max-w-[1600px] flex-wrap gap-2 px-4 py-3 md:px-8">
            {["w-72", "w-56", "w-80", "w-40", "w-60", "w-44", "w-52"].map((largura) => (
              <Skeleton key={largura} className={`h-11 rounded-xl ${largura}`} />
            ))}
          </div>
        </div>
        <div className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-5 md:space-y-6 md:px-8 md:py-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <CartaoVazio key={i} />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
            <PainelVazio />
            <PainelVazio className="hidden xl:block" />
          </div>
        </div>
      </main>
    </div>
  );
}
