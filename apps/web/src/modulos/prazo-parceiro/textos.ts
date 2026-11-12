/** Rótulos, cores de exibição e formatação das telas do Prazo do parceiro. */
import { SEM_TIPO } from "@erp/dominio/romaneio/hoje";
import { type NascidoAtrasado } from "@erp/shared/contratos/prazo-parceiro";

import { type StatusKpi } from "@/componentes/comum/KpiCard";
import { type Tom } from "@/componentes/comum/SeloStatus";

import { type Periodo } from "./busca";

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

/** Rótulo do tipo de documento nos filtros ("sem tipo" para o marcador de vazio). */
export const rotuloDoTipo = (tipo: string) => (tipo === SEM_TIPO ? "sem tipo" : tipo);

export const opcoesDeTipo = (tipos: readonly string[]) =>
  tipos.map((valor) => ({ valor, rotulo: rotuloDoTipo(valor) }));

/** O tom do SLA no `SeloStatus` (tabela). */
export const SELO_DO_SLA: Record<StatusKpi, Tom> = {
  bom: "sucesso",
  alerta: "alerta",
  ruim: "erro",
};

/** Cores da origem do prazo: as mesmas da barra "Origem do prazo" (1ª e 2ª séries). */
export const COR_DA_ORIGEM = {
  proprio: "var(--brand)",
  parceiro: "var(--serie-2)",
} as const;

/** Destino do CT-e nascido em atraso ("Cidade/UF"). */
export const destinoDe = (n: NascidoAtrasado) =>
  n.cidadeDestino ? `${n.cidadeDestino}${n.ufDestino ? `/${n.ufDestino}` : ""}` : null;
