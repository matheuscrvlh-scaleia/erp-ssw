import { formatarMoeda } from "@erp/shared/formatting";

import { SeloStatus } from "@/components/common/StatusBadge";

/** Selo de um alerta da linha (atraso, responsabilidade do cliente, TDE, peso/volume). */
export function SeloDoAlerta({
  alerta,
  fonte,
  tde,
}: {
  alerta: string;
  fonte: string;
  tde: number | null;
}) {
  if (alerta.startsWith("ATRASADO")) {
    return (
      <span title={`fonte: ${fonte}`}>
        <SeloStatus tom="erro">{alerta}</SeloStatus>
      </span>
    );
  }
  if (alerta === "TDE") {
    return (
      <span title={`TDE (taxa de dificuldade de entrega): ${formatarMoeda(tde)}`}>
        <SeloStatus tom="alerta" semIcone>
          TDE
        </SeloStatus>
      </span>
    );
  }
  return (
    <SeloStatus tom="neutro" semIcone>
      {alerta}
    </SeloStatus>
  );
}
