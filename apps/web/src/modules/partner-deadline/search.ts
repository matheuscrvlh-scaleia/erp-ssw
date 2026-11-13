/** Filtros do Prazo do parceiro na URL — os mesmos parâmetros de hoje. */
import { FILTROS_DA_LISTA, TAMANHOS_DA_LISTA } from "@erp/shared/contracts/partner-deadline";
import { z } from "@erp/shared/zod";

import { campoFiltro } from "@/hooks/use-url-filters";

export const PERIODOS = ["hoje", "7d", "30d", "mes"] as const;
export type Periodo = (typeof PERIODOS)[number];

const periodo = campoFiltro.opcao(PERIODOS, "30d");

export const esquemaPrazo = z.object({
  periodo,
  unidades: campoFiltro.lista(),
  parceiros: campoFiltro.lista(),
  tipos: campoFiltro.lista(),
  filtro: campoFiltro.opcao(FILTROS_DA_LISTA, "nascidos"),
  page: campoFiltro.pagina(),
  size: z.coerce
    .number()
    .refine((n) => TAMANHOS_DA_LISTA.some((t) => t === n))
    .catch(50),
});
export type BuscaPrazo = z.output<typeof esquemaPrazo>;

/** Detalhe do parceiro: período, unidades e tipos vêm da visão geral. */
export const esquemaDetalhe = z.object({
  periodo,
  unidades: campoFiltro.lista(),
  tipos: campoFiltro.lista(),
});
export const tamanhoDaLista = (n: number): (typeof TAMANHOS_DA_LISTA)[number] =>
  TAMANHOS_DA_LISTA.find((t) => t === n) ?? 50;

/** Filtros da consulta: só as listas preenchidas. */
export function filtrosDaBusca(
  b: { unidades: readonly string[]; parceiros?: readonly string[]; tipos: readonly string[] },
  intervalo: { inicio: string; fim: string },
) {
  return {
    inicio: intervalo.inicio,
    fim: intervalo.fim,
    ...(b.unidades.length > 0 ? { unidades: [...b.unidades] } : {}),
    ...(b.parceiros && b.parceiros.length > 0 ? { parceiros: [...b.parceiros] } : {}),
    ...(b.tipos.length > 0 ? { tipos: [...b.tipos] } : {}),
  };
}
