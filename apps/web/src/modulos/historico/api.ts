import { contratosHistorico as c } from "@erp/shared/contratos/historico";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

export const CHAVE_DO_HISTORICO = ["historico"] as const;

export const consultaHistorico = (inicio: string, fim: string, unidades: readonly string[]) =>
  queryOptions({
    queryKey: [...CHAVE_DO_HISTORICO, inicio, fim, unidades],
    queryFn: () => chamar(c.obter, { entrada: { inicio, fim, unidades: unidades.join(",") } }),
  });

export const consultaFeriados = (ano: number) =>
  queryOptions({
    queryKey: [...CHAVE_DO_HISTORICO, "feriados", ano],
    queryFn: () => chamar(c.listarFeriados, { entrada: { ano } }),
  });
