import { type PainelDeColetas } from "@erp/shared/contracts/pickups";
import { formatarDiaMes } from "@erp/shared/formatting";
import { ChartColumnStacked } from "lucide-react";

import { GraficoBarras } from "@/components/common/Charts";
import { Painel } from "@/components/common/Panel";

export function GraficoColetasPorDia({
  porDia,
  carregando,
}: {
  porDia: PainelDeColetas["porDia"] | undefined;
  carregando: boolean;
}) {
  return (
    <Painel titulo="Coletas por dia de cadastro" icone={ChartColumnStacked}>
      <GraficoBarras
        descricao="Coletas por dia de cadastro"
        dados={(porDia ?? []).map((p) => ({
          ...p,
          rotulo: formatarDiaMes(p.dia),
          demais: p.total - p.noPrazo - p.atrasadas,
        }))}
        eixoX="rotulo"
        formato="inteiro"
        carregando={carregando}
        series={[
          {
            chave: "noPrazo",
            nome: "Coletadas no prazo",
            cor: "var(--status-good)",
            pilha: "a",
          },
          {
            chave: "atrasadas",
            nome: "Coletadas atrasadas",
            cor: "var(--status-bad)",
            pilha: "a",
          },
          {
            chave: "demais",
            nome: "Em aberto ou canceladas",
            cor: "var(--grafico-comparacao)",
            pilha: "a",
          },
        ]}
      />
    </Painel>
  );
}
