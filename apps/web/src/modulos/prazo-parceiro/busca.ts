/** Filtros do Prazo do parceiro na URL — os mesmos parâmetros de hoje. */
import { FILTROS_DA_LISTA, TAMANHOS_DA_LISTA } from "@erp/shared/contratos/prazo-parceiro";
import { z } from "@erp/shared/zod";

import { campoFiltro } from "@/hooks/use-filtros-na-url";

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
/** Detalhe do parceiro: período, unidades e tipos vêm da visão geral. */
export const esquemaDetalhe = z.object({
  periodo,
  unidades: campoFiltro.lista(),
  tipos: campoFiltro.lista(),
});
export const tamanhoDaLista = (n: number): (typeof TAMANHOS_DA_LISTA)[number] =>
  TAMANHOS_DA_LISTA.find((t) => t === n) ?? 50;

export const ROTULO_PERIODO: Record<Periodo, string> = {
  hoje: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  mes: "Este mês",
};

export const ROTULO_FILTRO = {
  nascidos: "Só nascidos em atraso",
  prazo_parceiro: "Com prazo do parceiro",
  todos: "Todos",
} as const;

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
