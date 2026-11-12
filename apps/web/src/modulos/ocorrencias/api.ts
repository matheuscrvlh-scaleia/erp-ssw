import { type EntradaDe } from "@erp/shared/contrato";
import {
  type Card,
  contratosOcorrencias as c,
  type FiltrosDeCte,
  type Recortes,
} from "@erp/shared/contratos/ocorrencias";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

type EntradaDaLista = EntradaDe<typeof c.lista>;

/** Chaves do cache do módulo (nada fora daqui as invalida hoje). */
const chaves = {
  tudo: ["ocorrencias"] as const,
  painel: (entrada: FiltrosDeCte & Recortes) => [...chaves.tudo, "painel", entrada] as const,
  lista: (entrada: EntradaDaLista) => [...chaves.tudo, "lista", entrada] as const,
  opcoes: (entrada: EntradaDe<typeof c.opcoes>) => [...chaves.tudo, "opcoes", entrada] as const,
  conferentes: () => [...chaves.tudo, "conferentes"] as const,
  codigosDoCard: (card: Card, filtros: FiltrosDeCte) =>
    [...chaves.tudo, "codigos-do-card", card, filtros] as const,
};

export const consultaPainel = (entrada: FiltrosDeCte & Recortes) =>
  queryOptions({
    queryKey: chaves.painel(entrada),
    queryFn: () => chamar(c.painel, { entrada }),
  });

export const consultaLista = (entrada: EntradaDaLista) =>
  queryOptions({
    queryKey: chaves.lista(entrada),
    queryFn: () => chamar(c.lista, { entrada }),
  });

/** As opções só dependem do período e das unidades/filiais. */
export const consultaOpcoes = (entrada: EntradaDe<typeof c.opcoes>) =>
  queryOptions({
    queryKey: chaves.opcoes(entrada),
    queryFn: () => chamar(c.opcoes, { entrada }),
    staleTime: 5 * 60_000,
  });

export const consultaConferentes = queryOptions({
  queryKey: chaves.conferentes(),
  queryFn: () => chamar(c.conferentes),
  staleTime: 60 * 60_000,
});

export const consultaCodigosDoCard = (filtros: FiltrosDeCte, card: Card) =>
  queryOptions({
    queryKey: chaves.codigosDoCard(card, filtros),
    queryFn: () => chamar(c.codigosDoCard, { entrada: { ...filtros, card } }),
    staleTime: 60_000,
  });

/** A lista inteira com os mesmos filtros, numa leitura só (exportação). */
export const carregarListaInteira = ({ pagina: _p, tamanho: _t, ...filtros }: EntradaDaLista) =>
  chamar(c.exportar, { entrada: filtros }).then((r) => r.linhas);
