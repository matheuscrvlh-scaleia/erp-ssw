import {
  contratosComprovantes as c,
  type FiltrosDeComprovantes,
  type StatusDeComprovante,
} from "@erp/shared/contratos/comprovantes";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";
import { carregarTodasAsPaginas } from "@/lib/paginas";

export const consultaPainel = (filtros: FiltrosDeComprovantes) =>
  queryOptions({
    queryKey: ["comprovantes", "painel", filtros],
    queryFn: () => chamar(c.painel, { entrada: filtros }),
  });

export const consultaLista = (
  filtros: FiltrosDeComprovantes,
  status: StatusDeComprovante,
  pagina: number,
  tamanho: number,
) =>
  queryOptions({
    queryKey: ["comprovantes", "lista", filtros, status, pagina, tamanho],
    queryFn: () => chamar(c.lista, { entrada: { ...filtros, status, pagina, tamanho } }),
  });

export const carregarListaInteira = (filtros: FiltrosDeComprovantes, status: StatusDeComprovante) =>
  carregarTodasAsPaginas((pagina, tamanho) =>
    chamar(c.lista, { entrada: { ...filtros, status, pagina, tamanho } }),
  );
