import { contratosCalendario as c } from "@erp/shared/contratos/calendario";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

export const consultaCalendario = (ano: number) =>
  queryOptions({
    queryKey: ["calendario", ano],
    queryFn: () => chamar(c.obter, { entrada: { ano } }),
  });

/** Toda escrita invalida o calendário inteiro (todos os anos): recorrência atinge vários. */
export const CHAVE_DO_CALENDARIO = ["calendario"] as const;

/** Plataforma › Configurações › Feriados gerais (sob a chave do calendário: uma escrita invalida os dois). */
export const consultaFeriadosGerais = (ano: number) =>
  queryOptions({
    queryKey: [...CHAVE_DO_CALENDARIO, "gerais", ano],
    queryFn: () => chamar(c.listarFeriadosGerais, { entrada: { ano } }),
  });
