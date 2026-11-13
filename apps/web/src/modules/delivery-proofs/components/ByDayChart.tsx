import { type PainelDeComprovantes } from "@erp/shared/contracts/delivery-proofs";
import { formatarData, formatarDiaMes, formatarInteiro } from "@erp/shared/formatting";
import { ChartColumn } from "lucide-react";

import { GraficoBarras } from "@/components/common/Charts";
import { Painel } from "@/components/common/Panel";

import { pct } from "../texts";

/** Entregues e digitalizados por dia de entrega. */
export function GraficoPorDia({
  porDia,
  carregando,
}: {
  porDia: PainelDeComprovantes["porDia"];
  carregando: boolean;
}) {
  return (
    <Painel titulo="Tendência por dia de entrega" icone={ChartColumn}>
      <GraficoBarras
        descricao="Entregues e digitalizados por dia de entrega"
        dados={porDia.map((d) => ({
          ...d,
          rotulo: formatarDiaMes(d.dia),
        }))}
        eixoX="rotulo"
        formato="inteiro"
        carregando={carregando}
        series={[
          { chave: "entregues", nome: "Entregues", cor: "var(--grafico-comparacao)" },
          { chave: "digitalizados", nome: "Digitalizados", cor: "var(--brand)" },
        ]}
        dica={(d) => (
          <div className="text-xs">
            <p className="font-semibold">{formatarData(d.dia)}</p>
            <p>
              {formatarInteiro(d.digitalizados)} de {formatarInteiro(d.entregues)} · {pct(d.pct)}
            </p>
            {!d.coberto && <p className="text-muted-foreground">Sem o 930 deste dia</p>}
          </div>
        )}
      />
    </Painel>
  );
}
