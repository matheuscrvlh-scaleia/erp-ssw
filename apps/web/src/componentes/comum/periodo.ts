import { montarDataIso, somarDias } from "@erp/shared/datas";

/** Atalhos de período usados nas telas de hoje; "custom" = intervalo escolhido no calendário. */
export const ATALHOS_PERIODO = ["hoje", "7d", "30d", "mes", "mes_anterior"] as const;
export type AtalhoPeriodo = (typeof ATALHOS_PERIODO)[number];
export type Periodo = AtalhoPeriodo | "custom";

export const ROTULO_ATALHO: Record<AtalhoPeriodo, string> = {
  hoje: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  mes: "Mês",
  mes_anterior: "Mês anterior",
};

export interface Intervalo {
  inicio: string;
  fim: string;
}

/**
 * Intervalo (AAAA-MM-DD) do período. `hoje` é o dia de Brasília (decisão Q11), vindo de fora
 * (`hojeNoFuso`) para a regra não depender do relógio. "custom" sem as duas datas cai em `padrao`.
 * origem: resolvePeriodo de comprovantes.tsx / coletas.tsx (sistema atual)
 */
export function resolverPeriodo(
  periodo: Periodo,
  de: string,
  ate: string,
  hoje: string,
  padrao: AtalhoPeriodo = "mes",
): Intervalo {
  if (periodo === "custom") {
    return de && ate ? { inicio: de, fim: ate } : resolverPeriodo(padrao, "", "", hoje);
  }
  const [ano = 0, mes = 1] = hoje.split("-").map(Number);
  switch (periodo) {
    case "hoje":
      return { inicio: hoje, fim: hoje };
    case "7d":
      return { inicio: somarDias(hoje, -6), fim: hoje };
    case "30d":
      return { inicio: somarDias(hoje, -29), fim: hoje };
    case "mes":
      return { inicio: montarDataIso(ano, mes, 1), fim: hoje };
    case "mes_anterior":
      return {
        inicio: montarDataIso(ano, mes - 1, 1),
        fim: somarDias(montarDataIso(ano, mes, 1), -1),
      };
  }
}
