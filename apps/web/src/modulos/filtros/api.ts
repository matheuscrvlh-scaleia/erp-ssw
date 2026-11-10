import { type EntradaDe } from "@erp/shared/contrato";
import { contratosFiltros as c } from "@erp/shared/contratos/filtros";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

/**
 * Consultas dos filtros compartilhados (Performance, Lista, Romaneio, Ocorrências...). A chave
 * leva só o que a consulta usa, para trocar de tela reaproveitar o cache.
 */

/** Filiais próprias mudam raramente (cadastro da Plataforma). */
export const consultaFiliaisProprias = queryOptions({
  queryKey: ["filtros", "filiais-proprias"],
  queryFn: () => chamar(c.filiaisProprias),
  staleTime: 30 * 60_000,
});

export const consultaOpcoesDeFiltro = (entrada: EntradaDe<typeof c.opcoes>) =>
  queryOptions({
    queryKey: ["filtros", "opcoes", entrada],
    queryFn: () => chamar(c.opcoes, { entrada }),
  });

export const consultaSugestoes = (entrada: EntradaDe<typeof c.sugestoes>) =>
  queryOptions({
    queryKey: ["filtros", "sugestoes", entrada],
    queryFn: () => chamar(c.sugestoes, { entrada }),
    staleTime: 60_000,
  });

/** A lista de pagadores do período muda pouco (ciclos de carga de 30 min). */
export const consultaPagadores = (entrada: EntradaDe<typeof c.pagadores>) =>
  queryOptions({
    queryKey: ["filtros", "pagadores", entrada],
    queryFn: () => chamar(c.pagadores, { entrada }),
    staleTime: 15 * 60_000,
  });

export const consultaTiposDocumento = queryOptions({
  queryKey: ["filtros", "tipos-documento"],
  queryFn: () => chamar(c.tiposDocumento),
  staleTime: 30 * 60_000,
});
