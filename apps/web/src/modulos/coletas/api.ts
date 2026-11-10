import {
  contratosColetas as c,
  type FiltrosDeColetas,
  type StatusDaLista,
} from "@erp/shared/contratos/coletas";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";
import { carregarTodasAsPaginas } from "@/lib/paginas";

/** O 050 chega pelo FTP a cada ciclo: o painel reconsulta para o selo e os números acompanharem. */
export const consultaPainel = (filtros: FiltrosDeColetas) =>
  queryOptions({
    queryKey: ["coletas", "painel", filtros],
    queryFn: () => chamar(c.painel, { entrada: filtros }),
    refetchInterval: 5 * 60_000,
  });

export interface PaginaDaLista {
  status: StatusDaLista;
  busca: string;
  pagina: number;
  tamanho: number;
}

export const consultaLista = (filtros: FiltrosDeColetas, p: PaginaDaLista) =>
  queryOptions({
    queryKey: ["coletas", "lista", filtros, p],
    queryFn: () => chamar(c.lista, { entrada: { ...filtros, ...p } }),
  });

export const carregarListaInteira = (
  filtros: FiltrosDeColetas,
  status: StatusDaLista,
  busca: string,
) =>
  carregarTodasAsPaginas((pagina, tamanho) =>
    chamar(c.lista, { entrada: { ...filtros, status, busca, pagina, tamanho } }),
  );

export const consultaDetalhe = (unidade: string, numero: number) =>
  queryOptions({
    queryKey: ["coletas", "detalhe", unidade, numero],
    queryFn: () => chamar(c.detalhe, { parametros: { unidade, numero: String(numero) } }),
  });

export const CHAVE_DAS_COLETAS = ["coletas"] as const;
