import { type EntradaDe } from "@erp/shared/contract";
import { contratosFiltros as c } from "@erp/shared/contracts/filters";
import { queryOptions } from "@tanstack/react-query";

import { chamar } from "@/lib/api";

/**
 * Consultas dos filtros compartilhados (Performance, Lista, Romaneio, Ocorrências...). A chave
 * leva só o que a consulta usa, para trocar de tela reaproveitar o cache. Os seletores de
 * `componentes/comum` recebem estas consultas de quem os usa e as disparam só abertos.
 */

/** Período e filtros da tela que mudam as opções (unidades, sugestões). */
export type ContextoDosFiltros = EntradaDe<typeof c.opcoes>;

type EscopoDoTipoDocumento = EntradaDe<typeof c.tiposDocumentoNoPeriodo>;
type CampoDeTexto = EntradaDe<typeof c.sugestoes>["campo"];

const chaves = {
  tudo: ["filtros"] as const,
  filiaisProprias: () => [...chaves.tudo, "filiais-proprias"] as const,
  opcoes: (entrada: ContextoDosFiltros) => [...chaves.tudo, "opcoes", entrada] as const,
  pagadores: (entrada: EntradaDe<typeof c.pagadores>) =>
    [...chaves.tudo, "pagadores", entrada] as const,
  tiposDocumento: () => [...chaves.tudo, "tipos-documento"] as const,
  tiposNoPeriodo: (escopo: EscopoDoTipoDocumento) =>
    [...chaves.tudo, "tipos-documento-periodo", escopo] as const,
  sugestoes: (campo: CampoDeTexto, contexto: ContextoDosFiltros) =>
    [...chaves.tudo, "sugestoes", campo, contexto] as const,
};

/** Filiais próprias mudam raramente (cadastro da Plataforma). */
const consultaFiliaisProprias = queryOptions({
  queryKey: chaves.filiaisProprias(),
  queryFn: () => chamar(c.filiaisProprias),
  staleTime: 30 * 60_000,
});

const consultaOpcoesDeFiltro = (entrada: ContextoDosFiltros) =>
  queryOptions({
    queryKey: chaves.opcoes(entrada),
    queryFn: () => chamar(c.opcoes, { entrada }),
  });

/**
 * "Unidade responsável" (`SeletorDeFilial`): as unidades do período sem o próprio filtro de
 * unidade, mais as filiais próprias.
 */
export const consultasDoSeletorDeFilial = (contexto: ContextoDosFiltros) => ({
  opcoes: consultaOpcoesDeFiltro({ ...contexto, filiais: undefined }),
  proprias: consultaFiliaisProprias,
});

/** A lista de pagadores do período muda pouco (ciclos de carga de 30 min). */
export const consultaPagadores = (entrada: EntradaDe<typeof c.pagadores>) =>
  queryOptions({
    queryKey: chaves.pagadores(entrada),
    queryFn: () => chamar(c.pagadores, { entrada }),
    staleTime: 15 * 60_000,
  });

/** Tipos de documento da base inteira: muda muito pouco. */
export const consultaTiposDocumento = queryOptions({
  queryKey: chaves.tiposDocumento(),
  queryFn: () => chamar(c.tiposDocumento),
  staleTime: 60 * 60_000,
});

/** Quantos CT-e de cada tipo há no período da tela (nulo = não deu para contar). */
export const consultaTiposNoPeriodo = (escopo: EscopoDoTipoDocumento) =>
  queryOptions({
    queryKey: chaves.tiposNoPeriodo(escopo),
    queryFn: () => chamar(c.tiposDocumentoNoPeriodo, { entrada: escopo }),
  });

/** Sugestões do `FiltroTexto` de Remetente / Destino ("a|b"), com os filtros do período. */
export const sugestoesDoCampo = (contexto: ContextoDosFiltros, campo: CampoDeTexto) => ({
  chave: chaves.sugestoes(campo, contexto),
  buscar: (q: string) => chamar(c.sugestoes, { entrada: { ...contexto, campo, q } }),
});
