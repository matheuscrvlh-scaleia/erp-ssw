import { formatarData, formatarDiaMes } from "@erp/shared/formatacao";
import { Clock } from "lucide-react";

import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { GraficoBarras } from "@/componentes/comum/Graficos";
import { Painel } from "@/componentes/comum/Painel";

import { DicaDoPrejuizo } from "./DicaDoPrejuizo";
import { TituloDoBloco } from "./TituloDoBloco";

const HORAS = Array.from({ length: 24 }, (_, h) => h);

/** Frete perdido por horário (período de um dia) ou por dia (período maior). */
export function GraficoFretePerdido({
  porHora,
  porDia,
  diaUnico,
  carregando,
}: {
  porHora: readonly { hora: number; ctes: number; frete: number }[];
  porDia: readonly { dia: string; ctes: number; frete: number }[];
  diaUnico: boolean;
  carregando: boolean;
}) {
  const pontos = diaUnico
    ? HORAS.map((h) => {
        const l = porHora.find((x) => x.hora === h) ?? { ctes: 0, frete: 0 };
        return { rotulo: `${h}h`, titulo: `${h}h`, ctes: l.ctes, frete: l.frete };
      })
    : porDia.map((d) => ({
        rotulo: formatarDiaMes(d.dia),
        titulo: formatarData(d.dia),
        ctes: d.ctes,
        frete: d.frete,
      }));
  const total = pontos.reduce((s, p) => s + p.frete, 0);
  return (
    <Painel
      icone={Clock}
      titulo={
        <TituloDoBloco
          dica={
            diaUnico
              ? "Frete das cargas prejudicadas, agrupado pela hora em que a ocorrência penalizante foi registrada. Mostra em que faixa de horário o prejuízo mais se concentra."
              : "Frete das cargas prejudicadas, agrupado pelo dia de emissão do CTRC (mesma base do gráfico Prejuízo por dia). Mostra em que dia do período o prejuízo mais se concentra. Filtre um único dia para ver por horário."
          }
        >
          {diaUnico ? "Frete perdido por horário" : "Frete perdido por dia"}
        </TituloDoBloco>
      }
    >
      {!carregando && total === 0 ? (
        <EstadoVazio mensagem="Nenhum prejuízo registrado no período." />
      ) : (
        <GraficoBarras
          dados={pontos}
          eixoX="rotulo"
          series={[{ chave: "frete", nome: "Frete perdido", cor: "var(--status-bad)" }]}
          formato="inteiro"
          altura={200}
          carregando={carregando}
          descricao={diaUnico ? "Frete perdido por horário" : "Frete perdido por dia"}
          dica={(p) => <DicaDoPrejuizo titulo={p.titulo} frete={p.frete} ctes={p.ctes} />}
        />
      )}
    </Painel>
  );
}
