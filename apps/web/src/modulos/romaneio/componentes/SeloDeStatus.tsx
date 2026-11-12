import { statusDaLinha } from "@erp/dominio/romaneio/linha";
import { type LinhaLista } from "@erp/shared/contratos/romaneio";
import { Truck } from "lucide-react";

import { SeloStatus } from "@/componentes/comum/SeloStatus";

import { situacaoDe } from "../regras";

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
