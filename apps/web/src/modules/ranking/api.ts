import { type EntradaDe } from "@erp/shared/contract";
import { contratosPerformance } from "@erp/shared/contracts/performance";
import { contratosRanking as c, type FiltroDoRanking } from "@erp/shared/contracts/ranking";
import { mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";
import { ErroDoOperador } from "@/lib/error-message";

import { type Rascunho, regraParaSalvar } from "./rules";

type EntradaDaSerie = EntradaDe<typeof contratosPerformance.serie>;
type PeriodoDoCalculo = { inicio: string; fim: string; regra: string };

/** Chaves do cache do módulo (nada fora daqui as invalida). */
const chaves = {
  tudo: ["ranking"] as const,
  operacional: (filtro: FiltroDoRanking) => [...chaves.tudo, "operacional", filtro] as const,
  serieMensal: (entrada: EntradaDaSerie) => [...chaves.tudo, "serie-mensal", entrada] as const,
  /** Equipes, membros e unidades: toda escrita em Admin › Equipes invalida esta chave. */
  equipes: () => [...chaves.tudo, "equipes"] as const,
  atribuicoes: () => [...chaves.tudo, "atribuicao"] as const,
  atribuicao: (inicio: string, fim: string) => [...chaves.atribuicoes(), inicio, fim] as const,
  regras: () => [...chaves.tudo, "regras"] as const,
  calculos: () => [...chaves.tudo, "calculo"] as const,
  calculo: (id: string, periodo: PeriodoDoCalculo) => [...chaves.calculos(), id, periodo] as const,
  publico: (token: string, inicio: string, fim: string) =>
    [...chaves.tudo, "publico", token, inicio, fim] as const,
};

export const consultaRankingOperacional = (filtro: FiltroDoRanking) =>
  queryOptions({
    queryKey: chaves.operacional(filtro),
    queryFn: () => chamar(c.operacional, { entrada: filtro }),
  });

/** Série do gráfico (mesmo endpoint da Performance: `sla_serie`). */
export const consultaSerieMensal = (entrada: EntradaDaSerie) =>
  queryOptions({
    queryKey: chaves.serieMensal(entrada),
    queryFn: () => chamar(contratosPerformance.serie, { entrada }),
  });

export const consultaEquipes = queryOptions({
  queryKey: chaves.equipes(),
  queryFn: () => chamar(c.equipes),
});

export const consultaCtesParaAtribuir = (inicio: string, fim: string) =>
  queryOptions({
    queryKey: chaves.atribuicao(inicio, fim),
    queryFn: () =>
      chamar(c.ctesParaAtribuir, { entrada: { inicio, fim, somenteSemEquipe: "true" } }),
  });

export const consultaRegras = queryOptions({
  queryKey: chaves.regras(),
  queryFn: () => chamar(c.regras),
});

export const consultaCalculoDaEquipe = (id: string, periodo: PeriodoDoCalculo) =>
  queryOptions({
    queryKey: chaves.calculo(id, periodo),
    queryFn: () => chamar(c.calculoDaEquipe, { parametros: { id }, entrada: periodo }),
  });

export const consultaRankingPublico = (token: string, inicio: string, fim: string) =>
  queryOptions({
    queryKey: chaves.publico(token, inicio, fim),
    queryFn: () => chamar(c.publico, { parametros: { token }, entrada: { inicio, fim } }),
    retry: false,
  });

/** Simulação da regra num período: lida na hora, sem cache. */
export const simularRegra = (id: string, periodo: EntradaDe<typeof c.simularRegra>) =>
  chamar(c.simularRegra, { parametros: { id }, entrada: periodo });

const invalidarEquipes = (cliente: QueryClient) =>
  cliente.invalidateQueries({ queryKey: chaves.equipes() });

export const mutacaoCriarEquipe = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (entrada: EntradaDe<typeof c.salvarEquipe>) => chamar(c.salvarEquipe, { entrada }),
    onSuccess: () => invalidarEquipes(cliente),
  });

export const mutacaoIncluirMembro = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: ({
      equipeId,
      ...entrada
    }: { equipeId: string } & EntradaDe<typeof c.incluirMembro>) =>
      chamar(c.incluirMembro, { parametros: { id: equipeId }, entrada }),
    onSuccess: () => invalidarEquipes(cliente),
  });

export const mutacaoRemoverMembro = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (id: string) => chamar(c.removerMembro, { parametros: { id } }),
    onSuccess: () => invalidarEquipes(cliente),
  });

export const mutacaoGerarLink = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (id: string) => chamar(c.gerarLink, { parametros: { id } }),
    onSuccess: () => invalidarEquipes(cliente),
  });

export const mutacaoRevogarLink = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (id: string) => chamar(c.revogarLink, { parametros: { id } }),
    onSuccess: () => invalidarEquipes(cliente),
  });

/** A atribuição muda a lista de CT-e sem equipe e o cálculo das equipes. */
export const mutacaoAtribuirCtes = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (entrada: EntradaDe<typeof c.atribuir>) => chamar(c.atribuir, { entrada }),
    onSuccess: () =>
      Promise.all([
        cliente.invalidateQueries({ queryKey: chaves.atribuicoes() }),
        cliente.invalidateQueries({ queryKey: chaves.calculos() }),
      ]),
  });

/** O rascunho vira a entrada da API aqui; parâmetro inválido vira erro para o operador. */
export const mutacaoSalvarRegra = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (d: Rascunho) => {
      const r = regraParaSalvar(d);
      if (!r.ok) throw new ErroDoOperador(r.erro);
      return chamar(c.salvarRegra, { entrada: r.valor });
    },
    onSuccess: () => cliente.invalidateQueries({ queryKey: chaves.regras() }),
  });

export const mutacaoExcluirRegra = (cliente: QueryClient) =>
  mutationOptions({
    mutationFn: (id: string) => chamar(c.excluirRegra, { parametros: { id } }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: chaves.regras() }),
  });
