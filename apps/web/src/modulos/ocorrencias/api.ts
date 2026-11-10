import { type EntradaDe } from "@erp/shared/contrato";
import {
  type Card,
  contratosOcorrencias as c,
  type FiltrosDeCte,
  type Recortes,
} from "@erp/shared/contratos/ocorrencias";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";
import { carregarTodasAsPaginas } from "@/lib/paginas";

export const consultaPainel = (entrada: FiltrosDeCte & Recortes) =>
  queryOptions({
    queryKey: ["ocorrencias", "painel", entrada],
    queryFn: () => chamar(c.painel, { entrada }),
  });

export type EntradaDaLista = EntradaDe<typeof c.lista>;

export const consultaLista = (entrada: EntradaDaLista) =>
  queryOptions({
    queryKey: ["ocorrencias", "lista", entrada],
    queryFn: () => chamar(c.lista, { entrada }),
  });

/** As opções só dependem do período e das unidades/filiais. */
export const consultaOpcoes = (entrada: EntradaDe<typeof c.opcoes>) =>
  queryOptions({
    queryKey: ["ocorrencias", "opcoes", entrada],
    queryFn: () => chamar(c.opcoes, { entrada }),
    staleTime: 5 * 60_000,
  });

export const consultaConferentes = queryOptions({
  queryKey: ["ocorrencias", "conferentes"],
  queryFn: () => chamar(c.conferentes),
  staleTime: 60 * 60_000,
});

export const consultaCodigosDoCard = (filtros: FiltrosDeCte, card: Card) =>
  queryOptions({
    queryKey: ["ocorrencias", "codigos-do-card", card, filtros],
    queryFn: () => chamar(c.codigosDoCard, { entrada: { ...filtros, card } }),
    staleTime: 60_000,
  });

/** Todas as páginas da lista com os mesmos filtros (exportação). */
export const carregarListaInteira = (entrada: EntradaDaLista) =>
  carregarTodasAsPaginas((pagina, tamanho) =>
    chamar(c.lista, { entrada: { ...entrada, pagina, tamanho } }),
  );
