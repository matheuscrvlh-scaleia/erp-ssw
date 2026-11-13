import { type EntradaDe } from "@erp/shared/contract";
import { contratosAhgora as c } from "@erp/shared/contracts/ahgora";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

export const chaves = {
  tudo: ["ahgora"] as const,
  funcionarios: () => [...chaves.tudo, "funcionarios"] as const,
  departamentos: () => [...chaves.tudo, "departamentos"] as const,
  apuracao: (filtros: EntradaDe<typeof c.apuracao> | null) =>
    [...chaves.tudo, "apuracao", filtros] as const,
  batidas: (funcionarioId: string | null, inicio: string, fim: string) =>
    [...chaves.tudo, "batidas", funcionarioId, inicio, fim] as const,
};

/** Lista completa: a API já segue as páginas do Ahgora (até 5000). */
export const consultaFuncionarios = queryOptions({
  queryKey: chaves.funcionarios(),
  queryFn: () => chamar(c.funcionarios),
  staleTime: 5 * 60_000,
});

export const consultaDepartamentos = queryOptions({
  queryKey: chaves.departamentos(),
  queryFn: () => chamar(c.departamentos),
  staleTime: 30 * 60_000,
});

export const consultaApuracaoDoPonto = (filtros: EntradaDe<typeof c.apuracao> | null) =>
  queryOptions({
    queryKey: chaves.apuracao(filtros),
    queryFn: () =>
      filtros ? chamar(c.apuracao, { entrada: filtros }) : Promise.reject(new Error("Sem filtros")),
    enabled: filtros !== null,
  });

export const consultaBatidas = (
  funcionarioId: string | null,
  inicio: string,
  fim: string,
  valido: boolean,
) =>
  queryOptions({
    queryKey: chaves.batidas(funcionarioId, inicio, fim),
    queryFn: () =>
      funcionarioId
        ? chamar(c.batidas, { entrada: { funcionarioId, inicio, fim } })
        : Promise.reject(new Error("Selecione um colaborador")),
    enabled: funcionarioId !== null && valido,
  });
