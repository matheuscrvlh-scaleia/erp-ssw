import {
  type FiltrosDeColetas,
  STATUS_DA_LISTA,
  type StatusDaLista,
  type StatusDePrazo,
} from "@erp/shared/contratos/coletas";
import { z } from "@erp/shared/zod";

import { type EtiquetaDaBusca, resumirNomes } from "@/componentes/comum/FiltrosAvancados";
import { type AtalhoPeriodo, type Intervalo } from "@/componentes/comum/periodo";
import { type Tom } from "@/componentes/comum/SeloStatus";
import { campoFiltro } from "@/hooks/use-filtros-na-url";

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

export const ROTULO_DO_STATUS: Record<StatusDaLista, string> = {
  todas: "Todas",
  coletadas: "Coletadas",
  no_prazo: "Coletadas no prazo",
  atrasadas: "Coletadas atrasadas",
  abertas: "Em aberto",
  cadastradas: "Cadastradas",
  comandadas: "Comandadas",
  vencidas: "Vencidas",
  vence_hoje: "Vencem hoje",
  a_vencer: "A vencer",
  canceladas: "Canceladas",
  com_ctrc: "Com CT-e gerado",
  prejudicadas: "Prejudicadas pelo horário",
};

export const ROTULO_DO_PRAZO: Record<StatusDePrazo, { texto: string; tom: Tom }> = {
  no_prazo: { texto: "No prazo", tom: "sucesso" },
  atrasada: { texto: "Atrasada", tom: "erro" },
  cancelada: { texto: "Cancelada", tom: "neutro" },
  vencida: { texto: "Vencida", tom: "erro" },
  vence_hoje: { texto: "Vence hoje", tom: "alerta" },
  a_vencer: { texto: "A vencer", tom: "neutro" },
};

export const SEM_SOLICITANTE = "(sem solicitante)";

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

/** Liga/desliga um valor numa lista de filtro. */
export const alternar = (lista: readonly string[], valor: string) =>
  lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
