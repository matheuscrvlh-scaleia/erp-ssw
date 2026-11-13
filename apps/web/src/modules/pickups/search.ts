import { type FiltrosDeColetas, STATUS_DA_LISTA } from "@erp/shared/contracts/pickups";
import { z } from "@erp/shared/zod";

import { type EtiquetaDaBusca, resumirNomes } from "@/components/common/AdvancedFilters";
import { type AtalhoPeriodo, type Intervalo } from "@/components/common/period";
import { campoFiltro } from "@/hooks/use-url-filters";

import { ROTULO_DO_STATUS, SEM_SOLICITANTE } from "./texts";

export const ATALHOS_DE_COLETAS: readonly AtalhoPeriodo[] = ["7d", "30d", "mes", "mes_anterior"];

/** Parâmetros da URL de /coletas — os mesmos do sistema atual (padrão: 30 dias). */
export const esquemaDaBusca = z.object({
  periodo: campoFiltro.opcao(["hoje", "7d", "30d", "mes", "mes_anterior", "custom"], "30d"),
  de: campoFiltro.data(),
  ate: campoFiltro.data(),
  unidades: campoFiltro.lista(),
  solicitantes: campoFiltro.lista(),
  tipo: campoFiltro.opcao(["", "NORMAL", "REVERSA"], ""),
  status: campoFiltro.opcao(STATUS_DA_LISTA, "todas"),
});
export type BuscaColetas = z.output<typeof esquemaDaBusca>;

export function filtrosDaBusca(b: BuscaColetas, periodo: Intervalo): FiltrosDeColetas {
  return {
    inicio: periodo.inicio,
    fim: periodo.fim,
    unidades: b.unidades,
    solicitantes: b.solicitantes,
    tipo: b.tipo === "" ? null : b.tipo,
  };
}

export function etiquetasDaBusca(b: BuscaColetas): EtiquetaDaBusca<BuscaColetas>[] {
  return [
    ...(b.unidades.length > 0
      ? [{ rotulo: "Unidade", ...resumirNomes(b.unidades), limpar: { unidades: [] } }]
      : []),
    ...(b.solicitantes.length > 0
      ? [
          {
            rotulo: "Solicitante",
            ...resumirNomes(b.solicitantes.map((s) => s || SEM_SOLICITANTE)),
            limpar: { solicitantes: [] },
          },
        ]
      : []),
    ...(b.tipo !== ""
      ? [
          {
            rotulo: "Tipo",
            valor: b.tipo === "REVERSA" ? "Reversa" : "Normal",
            limpar: { tipo: "" as const },
          },
        ]
      : []),
    ...(b.status !== "todas"
      ? [
          {
            rotulo: "Situação",
            valor: ROTULO_DO_STATUS[b.status],
            limpar: { status: "todas" as const },
          },
        ]
      : []),
  ];
}
