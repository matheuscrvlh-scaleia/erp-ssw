import { type FiltrosRomaneio } from "@erp/shared/contratos/romaneio";
import { useQuery } from "@tanstack/react-query";

import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";

import { consultaPerformanceAjudantes } from "../api";

/** Ajudantes do período (as opções são os nomes da própria aba, sem o filtro de ajudante). */
export function FiltroAjudante({
  filtros,
  selecionados,
  aoMudar,
}: {
  filtros: FiltrosRomaneio;
  selecionados: readonly string[];
  aoMudar: (v: string[]) => void;
}) {
  const semAjudante: FiltrosRomaneio = { ...filtros };
  delete semAjudante.ajudantes;
  const q = useQuery(consultaPerformanceAjudantes(semAjudante));
  const nomes = q.data
    ? [...new Set(q.data.map((r) => r.nome))].sort((a, b) => a.localeCompare(b, "pt-BR"))
    : undefined;
  return (
    <FiltroMultiplo
      rotulo="Ajudante"
      opcoes={nomes?.map((valor) => ({ valor }))}
      selecionados={selecionados}
      aoMudar={aoMudar}
      textoVazio="todos"
    />
  );
}
