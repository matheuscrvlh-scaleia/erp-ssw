import { type EntradaDe } from "@erp/shared/contract";
import { contratosHistorico as c, type DadosDaAnotacao } from "@erp/shared/contracts/history";
import { mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";
import { chaves as chavesDoCalendario } from "@/modules/calendar/api";

export const chaves = {
  tudo: ["historico"] as const,
  periodo: (inicio: string, fim: string, unidades: readonly string[]) =>
    [...chaves.tudo, inicio, fim, unidades] as const,
  feriados: (ano: number) => [...chaves.tudo, "feriados", ano] as const,
};

export const consultaHistorico = (inicio: string, fim: string, unidades: readonly string[]) =>
  queryOptions({
    queryKey: chaves.periodo(inicio, fim, unidades),
    queryFn: () => chamar(c.obter, { entrada: { inicio, fim, unidades: unidades.join(",") } }),
  });

export const consultaFeriados = (ano: number) =>
  queryOptions({
    queryKey: chaves.feriados(ano),
    queryFn: () => chamar(c.listarFeriados, { entrada: { ano } }),
  });

export const mutacaoCriarAnotacao = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (entrada: DadosDaAnotacao) => chamar(c.criarAnotacao, { entrada }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: chaves.tudo }),
  });

export const mutacaoAlterarAnotacao = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: ({ id, dados }: { id: string; dados: DadosDaAnotacao }) =>
      chamar(c.alterarAnotacao, { parametros: { id }, entrada: dados }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: chaves.tudo }),
  });

export const mutacaoExcluirAnotacao = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (id: string) => chamar(c.excluirAnotacao, { parametros: { id } }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: chaves.tudo }),
  });

/** Feriado aparece no Histórico e no Calendário: toda escrita invalida os dois. */
const invalidarFeriados = (cliente: QueryClient) =>
  Promise.all([
    cliente.invalidateQueries({ queryKey: chaves.tudo }),
    cliente.invalidateQueries({ queryKey: chavesDoCalendario.tudo }),
  ]);

type DadosDoFeriado = EntradaDe<typeof c.criarFeriado>;

export const mutacaoCriarFeriado = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (entrada: DadosDoFeriado) => chamar(c.criarFeriado, { entrada }),
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

export const mutacaoImportarNacionais = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (ano: number) => chamar(c.importarNacionais, { entrada: { ano } }),
    onSuccess: () => invalidarFeriados(cliente),
  });
