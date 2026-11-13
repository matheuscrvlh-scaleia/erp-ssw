import {
  type PainelDeComprovantes,
  type StatusDeComprovante,
} from "@erp/shared/contracts/delivery-proofs";
import { formatarInteiro } from "@erp/shared/formatting";
import { FileCheck2, FileClock, PackageCheck, Percent } from "lucide-react";

import { KpiCard } from "@/components/common/KpiCard";

import { pct } from "../texts";

/** Os quatro cards do topo; clicar abre a lista lateral daquele status. */
export function CardsDeComprovantes({
  totais,
  abrir,
}: {
  totais: PainelDeComprovantes["totais"];
  abrir: (status: StatusDeComprovante) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        rotulo="CT-e entregue"
        valor={formatarInteiro(totais.entregues)}
        status="bom"
        neutro
        icone={PackageCheck}
        detalhe="Período completo"
        aoClicar={() => {
          abrir("todos");
        }}
      />
      <KpiCard
        rotulo="Digitalizados"
        valor={formatarInteiro(totais.digitalizados)}
        status="bom"
        icone={FileCheck2}
        detalhe="Com ocorrência 88"
        aoClicar={() => {
          abrir("digitalizados");
        }}
      />
      <KpiCard
        rotulo="% digitalizados"
        valor={pct(totais.pct)}
        status="bom"
        icone={Percent}
        progresso={totais.pct ?? undefined}
        detalhe="Digitalizados ÷ entregues (dias com o 930 importado)"
        aoClicar={() => {
          abrir("digitalizados");
        }}
      />
      <KpiCard
        rotulo="Pendentes"
        valor={formatarInteiro(totais.pendentes)}
        status="ruim"
        icone={FileClock}
        detalhe="Sem ocorrência 88"
        aoClicar={() => {
          abrir("pendentes");
        }}
      />
    </div>
  );
}
