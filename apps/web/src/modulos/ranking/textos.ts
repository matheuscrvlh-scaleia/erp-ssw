import { type CriterioDeRegra } from "@erp/shared/contratos/ranking";

import { type StatusKpi } from "@/componentes/comum/KpiCard";

import { type Base } from "./busca";

export const ROTULO_DA_BASE: Record<Base, string> = {
  emissao: "data de emissão",
  prevista: "data prevista de entrega",
};

export const ROTULO_DO_CRITERIO: Record<CriterioDeRegra, string> = {
  entregas_prazo: "Entregas no prazo",
  penalizante: "Penalidade por ocorrência",
  meta_produtividade: "Meta de produtividade",
  piso_performance: "Piso de performance",
  livre: "Critério livre",
};

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

/**
 * Escopo do gráfico mês a mês, antes de "por <base> · não segue o período acima": "todos os
 * parceiros", o nome do parceiro ou "N parceiros" (CNPJs de mesmo nome contam como um), e os
 * demais filtros. origem: escopoSerie (RankingTabela.tsx)
 */
export function escopoDaSerie(f: {
  nomesParceiros: readonly string[];
  destino: string;
  remetente: string;
  filiais: readonly string[];
  tipos: readonly string[];
}): string {
  const parceiros =
    f.nomesParceiros.length === 0
      ? "todos os parceiros"
      : f.nomesParceiros.length === 1
        ? (f.nomesParceiros[0] ?? "")
        : `${String(f.nomesParceiros.length)} parceiros`;
  return [
    parceiros,
    f.destino.trim() && `destino ${f.destino.trim()}`,
    f.remetente.trim() && `remetente ${f.remetente.trim()}`,
    f.filiais.length > 0 && `filiais ${f.filiais.join(", ")}`,
    f.tipos.length > 0 && `tipo ${f.tipos.join(", ")}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
