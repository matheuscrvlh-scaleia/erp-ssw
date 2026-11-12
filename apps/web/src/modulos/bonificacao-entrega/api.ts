import { type EntradaDe } from "@erp/shared/contrato";
import { contratosBonificacaoEntrega as c } from "@erp/shared/contratos/bonificacao-entrega";
import { mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

export const chaves = {
  tudo: ["bonificacao-entrega"] as const,
  unidades: ["bonificacao-entrega", "unidades"] as const,
  parametros: ["bonificacao-entrega", "parametros"] as const,
  apuracoes: ["bonificacao-entrega", "apuracao"] as const,
  apuracao: (filtros: EntradaDe<typeof c.apurar> | null) => [...chaves.apuracoes, filtros] as const,
  faltas: ["bonificacao-entrega", "faltas"] as const,
  faltasDoPeriodo: (inicio: string, fim: string) => [...chaves.faltas, inicio, fim] as const,
};

export const consultaUnidades = queryOptions({
  queryKey: chaves.unidades,
  queryFn: () => chamar(c.unidades),
  staleTime: 30 * 60_000,
});

export const consultaParametros = queryOptions({
  queryKey: chaves.parametros,
  queryFn: () => chamar(c.parametros),
  staleTime: 30 * 60_000,
});

export const consultaApuracao = (filtros: EntradaDe<typeof c.apurar> | null) =>
  queryOptions({
    queryKey: chaves.apuracao(filtros),
    queryFn: () => (filtros ? chamar(c.apurar, { entrada: filtros }) : Promise.resolve([])),
    enabled: filtros !== null,
  });

export const consultaFaltas = (inicio: string, fim: string) =>
  queryOptions({
    queryKey: chaves.faltasDoPeriodo(inicio, fim),
    queryFn: () => chamar(c.faltas, { entrada: { inicio, fim } }),
  });

/**
 * Registrar ou excluir falta muda a apuração: invalida as faltas e a apuração. Não espera o
 * refetch (com o ponto, a apuração leva segundos): o aviso de sucesso sai na hora.
 */
function invalidarFaltas(cliente: QueryClient) {
  void cliente.invalidateQueries({ queryKey: chaves.faltas });
  void cliente.invalidateQueries({ queryKey: chaves.apuracoes });
}

export const mutacaoRegistrarFalta = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (entrada: EntradaDe<typeof c.registrarFalta>) =>
      chamar(c.registrarFalta, { entrada }),
    onSuccess: () => {
      invalidarFaltas(cliente);
    },
  });

export const mutacaoExcluirFalta = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (id: string) => chamar(c.excluirFalta, { parametros: { id } }),
    onSuccess: () => {
      invalidarFaltas(cliente);
    },
  });
