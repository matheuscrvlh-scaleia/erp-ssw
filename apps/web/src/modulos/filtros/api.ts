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

/** A lista de pagadores do período muda pouco (ciclos de carga de 30 min). */
export const consultaPagadores = (entrada: EntradaDe<typeof c.pagadores>) =>
  queryOptions({
    queryKey: ["filtros", "pagadores", entrada],
    queryFn: () => chamar(c.pagadores, { entrada }),
    staleTime: 15 * 60_000,
  });

/** Tipos de documento da base inteira: muda muito pouco. */
export const consultaTiposDocumento = queryOptions({
  queryKey: ["filtros", "tipos-documento"],
  queryFn: () => chamar(c.tiposDocumento),
  staleTime: 60 * 60_000,
});

export type EscopoDoTipoDocumento = EntradaDe<typeof c.tiposDocumentoNoPeriodo>;

/** Quantos CT-e de cada tipo há no período da tela (nulo = não deu para contar). */
export const consultaTiposNoPeriodo = (escopo: EscopoDoTipoDocumento | undefined) =>
  queryOptions({
    queryKey: ["filtros", "tipos-documento-periodo", escopo],
    queryFn: () =>
      escopo ? chamar(c.tiposDocumentoNoPeriodo, { entrada: escopo }) : Promise.resolve(null),
  });
