import { type EntradaDe } from "@erp/shared/contrato";
import { contratosAhgora as c } from "@erp/shared/contratos/ahgora";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

/** Lista completa: a API já segue as páginas do Ahgora (até 5000). */
export const consultaFuncionarios = queryOptions({
  queryKey: ["ahgora-funcionarios"],
  queryFn: () => chamar(c.funcionarios),
  staleTime: 5 * 60_000,
});

export const consultaDepartamentos = queryOptions({
  queryKey: ["ahgora-departamentos"],
  queryFn: () => chamar(c.departamentos),
  staleTime: 30 * 60_000,
});

export const consultaApuracaoDoPonto = (filtros: EntradaDe<typeof c.apuracao> | null) =>
  queryOptions({
    queryKey: ["ahgora-apuracao", filtros],
    queryFn: () =>
      filtros ? chamar(c.apuracao, { entrada: filtros }) : Promise.reject(new Error("Sem filtros")),
    enabled: filtros !== null,
  });

export const consultaBatidas = (
  funcionarioId: string | null,
  start: string,
  end: string,
  valido: boolean,
) =>
  queryOptions({
    queryKey: ["ahgora-batidas", funcionarioId, start, end],
    queryFn: () =>
      funcionarioId
        ? chamar(c.batidas, { entrada: { employeeId: funcionarioId, start, end } })
        : Promise.reject(new Error("Selecione um colaborador")),
    enabled: funcionarioId !== null && valido,
  });
