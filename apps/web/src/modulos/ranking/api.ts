import { type EntradaDe } from "@erp/shared/contrato";
import { contratosPerformance } from "@erp/shared/contratos/performance";
import { contratosRanking as c, type FiltroDoRanking } from "@erp/shared/contratos/ranking";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

export const consultaRankingOperacional = (filtro: FiltroDoRanking) =>
  queryOptions({
    queryKey: ["ranking-operacional", filtro],
    queryFn: () => chamar(c.operacional, { entrada: filtro }),
  });

/** Série do gráfico (mesmo endpoint da Performance: `sla_serie`). */
export const consultaSerieMensal = (entrada: EntradaDe<typeof contratosPerformance.serie>) =>
  queryOptions({
    queryKey: ["ranking-serie-mensal", entrada],
    queryFn: () => chamar(contratosPerformance.serie, { entrada }),
  });

/** Equipes, membros e unidades: toda escrita em Admin › Equipes invalida esta chave. */
export const CHAVE_DAS_EQUIPES = ["ranking-equipes"] as const;

export const consultaEquipes = queryOptions({
  queryKey: CHAVE_DAS_EQUIPES,
  queryFn: () => chamar(c.equipes),
});

export const consultaCtesParaAtribuir = (inicio: string, fim: string) =>
  queryOptions({
    queryKey: ["ranking-atribuicao", inicio, fim],
    queryFn: () =>
      chamar(c.ctesParaAtribuir, { entrada: { inicio, fim, somenteSemEquipe: "true" } }),
  });

export const CHAVE_DAS_REGRAS = ["ranking-regras"] as const;

export const consultaRegras = queryOptions({
  queryKey: CHAVE_DAS_REGRAS,
  queryFn: () => chamar(c.regras),
});

export const consultaCalculoDaEquipe = (
  id: string,
  periodo: { inicio: string; fim: string; regra: string },
) =>
  queryOptions({
    queryKey: ["ranking-calculo", id, periodo],
    queryFn: () => chamar(c.calculoDaEquipe, { parametros: { id }, entrada: periodo }),
  });

export const consultaRankingPublico = (token: string, inicio: string, fim: string) =>
  queryOptions({
    queryKey: ["ranking-publico", token, inicio, fim],
    queryFn: () => chamar(c.publico, { parametros: { token }, entrada: { inicio, fim } }),
    retry: false,
  });
