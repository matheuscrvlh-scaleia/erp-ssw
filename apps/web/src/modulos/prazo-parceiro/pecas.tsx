/** Peças comuns da visão geral e do detalhe do Prazo do parceiro. */
import { Alternador } from "@/componentes/comum/Alternador";
import { ROTULO_ATALHO } from "@/componentes/comum/periodo";
import { cn } from "@/lib/utils";

import { type Periodo, PERIODOS } from "./busca";

/** Atalhos de período de hoje (Hoje, 7 dias, 30 dias, Mês; sem intervalo livre). */
export function AlternadorDePeriodo({
  atual,
  aoMudar,
}: {
  atual: Periodo;
  aoMudar: (p: Periodo) => void;
}) {
  return (
    <Alternador
      rotulo="Período"
      opcoes={PERIODOS.map((p) => ({ valor: p, rotulo: ROTULO_ATALHO[p] }))}
      valor={atual}
      aoMudar={aoMudar}
    />
  );
}

/** Cores da origem do prazo: as mesmas da barra "Origem do prazo" (1ª e 2ª séries). */
export const COR_DA_ORIGEM = {
  proprio: "var(--brand)",
  parceiro: "var(--serie-2)",
} as const;

export function EtiquetaDeOrigem({ origem }: { origem: "proprio" | "parceiro" }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-[12px] font-semibold",
        origem === "parceiro"
          ? "border-serie-2/40 bg-serie-2/12 text-foreground"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: COR_DA_ORIGEM[origem] }}
      />
      {origem === "parceiro" ? "Parceiro" : "Próprio"}
    </span>
  );
}

/** Número do CT-e nas tabelas (abre o detalhe pela linha). */
export function NumeroDoCtrc({ numero }: { numero: string }) {
  return <span className="font-mono text-[12.5px] font-semibold text-brand">{numero}</span>;
}
