import { statusDaLinha } from "@erp/domain/manifest/row";
import { type LinhaLista } from "@erp/shared/contracts/manifest";
import { Truck } from "lucide-react";

import { SeloStatus } from "@/components/common/StatusBadge";

import { situacaoDe } from "../rules";

/** Status único por linha, do mais avançado para o menos (mesma regra da exportação). */
export function SeloDeStatus({ linha }: { linha: LinhaLista }) {
  const status = statusDaLinha(situacaoDe(linha));
  switch (status) {
    case "Entregue":
      return <SeloStatus tom="sucesso">Entregue</SeloStatus>;
    case "Baixado":
      return (
        <span
          title={
            linha.ultimaOcorrencia
              ? `Encerrado por baixa formal (código ${linha.ultimaOcorrencia.codigo})`
              : "Encerrado por baixa formal"
          }
        >
          <SeloStatus tom="alerta">Baixado</SeloStatus>
        </span>
      );
    case "Em rota":
      return (
        <SeloStatus tom="info" icone={Truck}>
          Em rota
        </SeloStatus>
      );
    case "Pendente":
      return <SeloStatus tom="neutro">Pendente</SeloStatus>;
  }
}
