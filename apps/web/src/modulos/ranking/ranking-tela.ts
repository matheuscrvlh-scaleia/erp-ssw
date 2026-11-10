import { type LinhaDoRanking } from "@erp/shared/contratos/ranking";

import { type Status } from "./kit-local";

/**
 * Regras da tela do ranking operacional (cards, nível de cor, ordenação, filtro dos cards).
 * origem: RankingTabela.tsx (sistema atual)
 */

// TODO(admin): ler `sla_meta_pct` e `sla_alerta_amarelo_pct` das configurações da empresa.
export const META_PADRAO = 0.95;
export const ALERTA_PADRAO = 0.9;

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

export function nivelDoSla(sla: number | null, meta: number, alerta: number): Status | null {
  if (sla === null) return null;
  if (sla >= meta) return "good";
  if (sla >= alerta) return "warn";
  return "bad";
}

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

/**
 * Busca da Listagem detalhada no formato do roteador (texto puro; lista em JSON).
 * TODO(listagem): usar o tipo de busca da rota `/performance/lista` quando ela existir na main.
 */
export function caminhoDaLista(busca: Record<string, string | string[]>): string {
  const q = new URLSearchParams();
  for (const [chave, valor] of Object.entries(busca)) {
    if (Array.isArray(valor)) {
      if (valor.length > 0) q.set(chave, JSON.stringify(valor));
    } else if (valor !== "") {
      q.set(chave, valor);
    }
  }
  return `/performance/lista?${q.toString()}`;
}
