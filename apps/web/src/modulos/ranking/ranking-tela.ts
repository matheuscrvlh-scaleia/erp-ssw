import { type LinhaDoRanking } from "@erp/shared/contratos/ranking";

import { type StatusKpi } from "@/componentes/comum/KpiCard";

/**
 * Regras da tela do ranking operacional (cards, nível de cor, ordenação, filtro dos cards).
 * origem: RankingTabela.tsx (sistema atual)
 */

/** Fração do percentual configurado; sem valor (ou inválido), o padrão. */
function fracao(valor: string | undefined, padrao: number): number {
  const n = Number(valor);
  return valor === undefined || !Number.isFinite(n) ? padrao : n / 100;
}

/**
 * Meta e alerta amarelo do SLA, das configurações da empresa (`sla_meta_pct`,
 * `sla_alerta_amarelo_pct`); 95% e 90% enquanto não chegam.
 * origem: useSlaThresholds (sistema atual)
 */
export function limiaresDoSla(valores: Readonly<Record<string, string>> | undefined): {
  meta: number;
  alerta: number;
} {
  return {
    meta: fracao(valores?.["sla_meta_pct"], 0.95),
    alerta: fracao(valores?.["sla_alerta_amarelo_pct"], 0.9),
  };
}

export type ChaveDeOrdem =
  | "nome"
  | "totalCtes"
  | "entregue"
  | "noPrazo"
  | "foraPrazo"
  | "foraCliente"
  | "foraTransp"
  | "slaPct"
  | "aEntregar"
  | "atrasadas"
  | "peso"
  | "volumes"
  | "frete";

export type FiltroDoCard = "todos" | "na_meta" | "abaixo_meta";

export function nivelDoSla(sla: number | null, meta: number, alerta: number): StatusKpi | null {
  if (sla === null) return null;
  if (sla >= meta) return "bom";
  if (sla >= alerta) return "alerta";
  return "ruim";
}

/** Cores do nível (bolinha, texto do SLA, fundo da linha ruim): paleta --status-* do tema. */
export const COR_DO_NIVEL: Record<StatusKpi, { cor: string; texto: string; fundo: string }> = {
  bom: {
    cor: "var(--status-good)",
    texto: "var(--status-good-fg)",
    fundo: "var(--status-good-bg)",
  },
  alerta: {
    cor: "var(--status-warn)",
    texto: "var(--status-warn-fg)",
    fundo: "var(--status-warn-bg)",
  },
  ruim: { cor: "var(--status-bad)", texto: "var(--status-bad-fg)", fundo: "var(--status-bad-bg)" },
};

/** SLA médio ponderado: (Σ entregue − Σ fora por culpa da transportadora) ÷ Σ entregue. */
export function kpisDoRanking(linhas: readonly LinhaDoRanking[], meta: number) {
  const totalCtes = linhas.reduce((s, r) => s + r.totalCtes, 0);
  const entregue = linhas.reduce((s, r) => s + r.entregue, 0);
  const foraTransp = linhas.reduce((s, r) => s + r.foraTransp, 0);
  return {
    grupos: linhas.length,
    totalCtes,
    slaMedio: entregue > 0 ? (entregue - foraTransp) / entregue : null,
    abaixoMeta: linhas.filter((r) => r.slaPct !== null && r.slaPct < meta).length,
  };
}

export function filtrarPorCard(
  linhas: readonly LinhaDoRanking[],
  filtro: FiltroDoCard,
  meta: number,
): LinhaDoRanking[] {
  if (filtro === "na_meta") return linhas.filter((r) => r.slaPct !== null && r.slaPct >= meta);
  if (filtro === "abaixo_meta") return linhas.filter((r) => r.slaPct !== null && r.slaPct < meta);
  return [...linhas];
}

/** Nulos (ex.: SLA sem entregas) sempre por último, em qualquer direção. */
export function ordenarLinhas(
  linhas: readonly LinhaDoRanking[],
  chave: ChaveDeOrdem,
  direcao: "asc" | "desc",
  nomeDe: (r: LinhaDoRanking) => string,
): LinhaDoRanking[] {
  const valor = (r: LinhaDoRanking): number | string | null =>
    chave === "nome" ? nomeDe(r) : r[chave];
  const sinal = direcao === "asc" ? 1 : -1;
  return [...linhas].sort((a, b) => {
    const va = valor(a);
    const vb = valor(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (typeof va === "string" || typeof vb === "string") {
      return sinal * String(va).localeCompare(String(vb), "pt-BR");
    }
    return sinal * (va - vb);
  });
}

/** Percentual com vírgula e uma casa ("95,7%"); nulo = "—". */
export function formatarPct(v: number | null): string {
  return v === null
    ? "—"
    : `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
