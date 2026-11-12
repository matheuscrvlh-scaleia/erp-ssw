import { type PainelDeComprovantes } from "@erp/shared/contratos/comprovantes";
import { formatarData, formatarDiaMes, formatarInteiro } from "@erp/shared/formatacao";
import { ChartColumn } from "lucide-react";

import { GraficoBarras } from "@/componentes/comum/Graficos";
import { Painel } from "@/componentes/comum/Painel";

import { pct } from "../textos";

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
