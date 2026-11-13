import { type EntradaDe, type SaidaDe } from "@erp/shared/contract";
import { contratosIngestaoSsw as c } from "@erp/shared/contracts/ssw-ingestion";
import { mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

const MINUTO = 60_000;

/** Toda escrita destas telas invalida o grupo inteiro (saúde, credenciais, eventos). */
export const chaves = {
  tudo: ["ingestao-ssw"] as const,
  saude: (empresaId: string) => [...chaves.tudo, "saude", empresaId] as const,
  atualizacao: (empresaId: string) => [...chaves.tudo, "atualizacao", empresaId] as const,
  bi2: () => [...chaves.tudo, "bi2-0017"] as const,
  credenciais: () => [...chaves.tudo, "credenciais"] as const,
  eventosWebhook: () => [...chaves.tudo, "webhook-eventos"] as const,
  diagnostico: () => [...chaves.tudo, "diagnostico"] as const,
};

/** Faixa "Integração SSW indisponível" (layout). */
export const consultaSaudeSsw = (empresaId: string) =>
  queryOptions({
    queryKey: chaves.saude(empresaId),
    queryFn: () => chamar(c.saude),
    staleTime: MINUTO,
    refetchInterval: MINUTO,
  });

/**
 * Horário do `SeloAtualizacao` ("Dados atualizados em…") e XML aguardando (só a Plataforma).
 * Uso: `const { data } = useQuery(consultaAtualizacaoDosDados(empresaId));`
 */
export const consultaAtualizacaoDosDados = (empresaId: string) =>
  queryOptions({
    queryKey: chaves.atualizacao(empresaId),
    queryFn: () => chamar(c.atualizacao),
    staleTime: MINUTO,
    refetchInterval: MINUTO,
  });

export const consultaBi2 = queryOptions({
  queryKey: chaves.bi2(),
  queryFn: () => chamar(c.bi2Status),
  refetchInterval: 30_000,
});

export const consultaCredenciais = queryOptions({
  queryKey: chaves.credenciais(),
  queryFn: () => chamar(c.credenciais),
});

export const consultaEventosWebhook = queryOptions({
  queryKey: chaves.eventosWebhook(),
  queryFn: () => chamar(c.eventosWebhook),
  refetchInterval: 15_000,
});

export const consultaDiagnostico = queryOptions({
  queryKey: chaves.diagnostico(),
  queryFn: () => chamar(c.diagnostico),
  refetchInterval: 30_000,
});

/*
 * As mutações recebem `aoConcluir` (o aviso da tela), chamado antes de invalidar o cache: o toast
 * sai assim que a API responde, sem esperar a releitura.
 */

export const mutacaoRodarBi2 = (
  cliente: QueryClient,
  aoConcluir: (saida: SaidaDe<typeof c.rodarBi2>) => void,
) =>
  mutationOptions({
    mutationFn: (alvo: string) => chamar(c.rodarBi2, { entrada: { data: alvo } }),
    onSuccess: (saida) => {
      aoConcluir(saida);
      return cliente.invalidateQueries({ queryKey: chaves.tudo });
    },
  });

export const mutacaoSalvarCredenciais = (
  cliente: QueryClient,
  aoConcluir: (saida: SaidaDe<typeof c.salvarCredenciais>) => void,
) =>
  mutationOptions({
    mutationFn: (entrada: EntradaDe<typeof c.salvarCredenciais>) =>
      chamar(c.salvarCredenciais, { entrada }),
    onSuccess: (saida) => {
      aoConcluir(saida);
      return cliente.invalidateQueries({ queryKey: chaves.tudo });
    },
  });

export const mutacaoTestarConexao = (
  cliente: QueryClient,
  aoConcluir: (saida: SaidaDe<typeof c.testarConexao>) => void,
) =>
  mutationOptions({
    mutationFn: () => chamar(c.testarConexao),
    onSuccess: (saida) => {
      aoConcluir(saida);
      return cliente.invalidateQueries({ queryKey: chaves.tudo });
    },
  });

export const mutacaoReprocessarEvento = (cliente: QueryClient, aoConcluir: () => void) =>
  mutationOptions({
    mutationFn: (id: string) => chamar(c.reprocessarEvento, { parametros: { id } }),
    onSuccess: () => {
      aoConcluir();
      return cliente.invalidateQueries({ queryKey: chaves.tudo });
    },
  });

export const mutacaoReprocessarTokenIncorreto = (
  cliente: QueryClient,
  aoConcluir: (saida: SaidaDe<typeof c.reprocessarTokenIncorreto>) => void,
) =>
  mutationOptions({
    mutationFn: () => chamar(c.reprocessarTokenIncorreto),
    onSuccess: (saida) => {
      aoConcluir(saida);
      return cliente.invalidateQueries({ queryKey: chaves.tudo });
    },
  });
