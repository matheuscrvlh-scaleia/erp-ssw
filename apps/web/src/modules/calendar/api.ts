import { type EntradaDe } from "@erp/shared/contract";
import { contratosCalendario as c, type DadosDoFeriado } from "@erp/shared/contracts/calendar";
import { mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";
import { chaves as chavesDoHistorico } from "@/modules/history/api";

/** Toda escrita invalida o calendário inteiro (todos os anos): recorrência atinge vários. */
export const chaves = {
  tudo: ["calendario"] as const,
  ano: (ano: number) => [...chaves.tudo, ano] as const,
  /** Plataforma › Configurações › Feriados gerais (sob a chave do calendário). */
  gerais: (ano: number) => [...chaves.tudo, "gerais", ano] as const,
};

export const consultaCalendario = (ano: number) =>
  queryOptions({
    queryKey: chaves.ano(ano),
    queryFn: () => chamar(c.obter, { entrada: { ano } }),
  });

export const consultaFeriadosGerais = (ano: number) =>
  queryOptions({
    queryKey: chaves.gerais(ano),
    queryFn: () => chamar(c.listarFeriadosGerais, { entrada: { ano } }),
  });

/** Feriado aparece no Calendário e no Histórico: toda escrita invalida os dois. */
const invalidarFeriados = (cliente: QueryClient) =>
  Promise.all([
    cliente.invalidateQueries({ queryKey: chaves.tudo }),
    cliente.invalidateQueries({ queryKey: chavesDoHistorico.tudo }),
  ]);

export const mutacaoGerarNacionais = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (entrada: EntradaDe<typeof c.gerarNacionais>) =>
      chamar(c.gerarNacionais, { entrada }),
    onSuccess: () => invalidarFeriados(cliente),
  });

export const mutacaoCriarFeriado = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (entrada: EntradaDe<typeof c.criarFeriado>) => chamar(c.criarFeriado, { entrada }),
    onSuccess: () => invalidarFeriados(cliente),
  });

export const mutacaoAlterarFeriado = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: ({ id, dados }: { id: string; dados: DadosDoFeriado }) =>
      chamar(c.alterarFeriado, { parametros: { id }, entrada: dados }),
    onSuccess: () => invalidarFeriados(cliente),
  });

export const mutacaoExcluirFeriado = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (id: string) => chamar(c.excluirFeriado, { parametros: { id } }),
    onSuccess: () => invalidarFeriados(cliente),
  });

export const mutacaoCriarFeriadoGeral = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (entrada: EntradaDe<typeof c.criarFeriadoGeral>) =>
      chamar(c.criarFeriadoGeral, { entrada }),
    onSuccess: () => invalidarFeriados(cliente),
  });

export const mutacaoAlterarFeriadoGeral = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: ({ id, dados }: { id: string; dados: DadosDoFeriado }) =>
      chamar(c.alterarFeriadoGeral, { parametros: { id }, entrada: dados }),
    onSuccess: () => invalidarFeriados(cliente),
  });

export const mutacaoExcluirFeriadoGeral = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (id: string) => chamar(c.excluirFeriadoGeral, { parametros: { id } }),
    onSuccess: () => invalidarFeriados(cliente),
  });
