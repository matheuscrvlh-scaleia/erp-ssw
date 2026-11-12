import {
  contratosComprovantes as c,
  type FiltrosDeComprovantes,
  type StatusDeComprovante,
} from "@erp/shared/contratos/comprovantes";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

/** Chaves do cache do módulo (a tela só lê; nada as invalida hoje). */
const chaves = {
  tudo: ["comprovantes"] as const,
  painel: (filtros: FiltrosDeComprovantes) => [...chaves.tudo, "painel", filtros] as const,
  lista: (
    filtros: FiltrosDeComprovantes,
    status: StatusDeComprovante,
    pagina: number,
    tamanho: number,
  ) => [...chaves.tudo, "lista", filtros, status, pagina, tamanho] as const,
};

export const consultaPainel = (filtros: FiltrosDeComprovantes) =>
  queryOptions({
    queryKey: chaves.painel(filtros),
    queryFn: () => chamar(c.painel, { entrada: filtros }),
  });

export const consultaLista = (
  filtros: FiltrosDeComprovantes,
  status: StatusDeComprovante,
  pagina: number,
  tamanho: number,
) =>
  queryOptions({
    queryKey: chaves.lista(filtros, status, pagina, tamanho),
    queryFn: () => chamar(c.lista, { entrada: { ...filtros, status, pagina, tamanho } }),
  });

export const carregarListaInteira = (filtros: FiltrosDeComprovantes, status: StatusDeComprovante) =>
  chamar(c.exportar, { entrada: { ...filtros, status } }).then((r) => r.linhas);
