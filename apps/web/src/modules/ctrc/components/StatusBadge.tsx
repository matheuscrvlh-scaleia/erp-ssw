import { type DetalheCtrc } from "@erp/shared/contracts/ctrc";
import { Truck } from "lucide-react";

import { SeloStatus } from "@/components/common/StatusBadge";

export function SeloDeStatus({
  status,
  entregue,
  baixa,
}: {
  status: string | null;
  entregue: boolean;
  baixa: DetalheCtrc["finalizacao"]["baixa"];
}) {
  if (entregue) return <SeloStatus tom="sucesso">Entregue</SeloStatus>;
  if (baixa) {
    return (
      <SeloStatus tom="neutro">
        Baixado sem entrega · {String(baixa.codigo).padStart(2, "0")}
        {baixa.descricao ? ` ${baixa.descricao}` : ""}
      </SeloStatus>
    );
  }
  if (!status) return <SeloStatus tom="neutro">Sem status</SeloStatus>;
  return (
    <SeloStatus tom="info" icone={Truck}>
      {status}
    </SeloStatus>
  );
}
