import { Alternador } from "@/componentes/comum/Alternador";
import { ROTULO_ATALHO } from "@/componentes/comum/periodo";

import { type Periodo, PERIODOS } from "../busca";

/** Atalhos de período de hoje (Hoje, 7 dias, 30 dias, Mês; sem intervalo livre). */
export function AlternadorDePeriodo({
  atual,
  aoMudar,
}: {
  atual: Periodo;
  aoMudar: (p: Periodo) => void;
}) {
  return (
    <Alternador
      rotulo="Período"
      opcoes={PERIODOS.map((p) => ({ valor: p, rotulo: ROTULO_ATALHO[p] }))}
      valor={atual}
      aoMudar={aoMudar}
    />
  );
}
