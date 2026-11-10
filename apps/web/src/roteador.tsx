import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { ErroDeRota } from "@/componentes/comum/ErroDeRota";
import { PaginaNaoEncontrada } from "@/componentes/comum/PaginaNaoEncontrada";
import { ehSessaoVencida, ErroDaApi } from "@/lib/api";

import { routeTree } from "./routeTree.gen";

/** Repete só falha de rede, uma vez. Timeout de consulta repetido só derruba o banco de novo. */
function repetirSoFalhaDeRede(falhas: number, erro: unknown): boolean {
  return falhas < 1 && erro instanceof ErroDaApi && erro.status === 0;
}

/**
 * Política de cache do painel atual (contorno de timeout, não gordura): consultas pesadas
 * reaproveitadas por 5 min, guardadas por 15 min e nunca refeitas só por voltar à janela ou
 * remontar a tela — senão trocar de aba disparava várias consultas pesadas ao mesmo tempo.
 * `aoVencerSessao`: a renovação falhou no meio do uso (refresh vencido ou revogado).
 */
export function criarQueryClient(aoVencerSessao: () => void): QueryClient {
  const tratar = (erro: unknown) => {
    if (ehSessaoVencida(erro)) aoVencerSessao();
  };
  return new QueryClient({
    queryCache: new QueryCache({ onError: tratar }),
    mutationCache: new MutationCache({ onError: tratar }),
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        gcTime: 15 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        retry: repetirSoFalhaDeRede,
      },
      mutations: { retry: false },
    },
  });
}

export function criarRoteador(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // O React Query decide quando refazer; o router não guarda cópia própria.
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: ErroDeRota,
    defaultNotFoundComponent: PaginaNaoEncontrada,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof criarRoteador>;
  }
}
