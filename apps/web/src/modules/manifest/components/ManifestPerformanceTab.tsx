/** Aba Performance por romaneio. origem: features/romaneio/Fase2Views.tsx (sistema atual) */
import { formatarInteiro, formatarMoeda, formatarPercentual } from "@erp/shared/formatting";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  CalendarClock,
  CircleCheck,
  CircleX,
  Percent,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
  Truck,
} from "lucide-react";

import { KpiCard } from "@/components/common/KpiCard";

import { consultaKpis, consultaPrejuizo } from "../api";
import { pctDe } from "../rules";
import { type PropsDaAba } from "../search";
import { textoDoPrejuizo } from "../texts";
import { AtribuicaoLegenda } from "./AssignmentLegend";
import { TabelaPorViagem } from "./ByTripTable";
import { Distribuicao } from "./Distribution";
import { GradeDeIndicadores } from "./IndicatorsGrid";
import { GraficoFretePerdido } from "./LostFreightChart";
import { CardsDoPeriodo, type PropsCardsDoPeriodo } from "./PeriodCards";

export function AbaPerformanceRomaneio({
  filtros,
  aoAbrir,
  cards,
  nomeCurto,
}: PropsDaAba & { cards: PropsCardsDoPeriodo; nomeCurto: string }) {
  const q = useQuery(consultaKpis(filtros));
  const prejuizo = useQuery(consultaPrejuizo(filtros));
  const k = q.data;
  const base = k?.romaneado ?? 0;
  const pctBase = (n: number) =>
    base > 0 ? `${formatarPercentual((n / base) * 100, { escala: "cem" })} da base desta aba` : "—";
  const positiva = k ? pctDe(k.entregue, base) : null;
  const pPrejuizo = k ? pctDe(k.prejudicada, base) : null;
  const codigos = filtros.codigos;
  const prejuizoDe = (resto: string | undefined) =>
    [textoDoPrejuizo(codigos), resto].filter(Boolean).join(" · ");
  return (
    <>
      <AtribuicaoLegenda codigos={codigos} />
      <p className="text-[13px] text-muted-foreground">
        {k
          ? `Base desta aba: ${formatarInteiro(base)} cargas que já saíram para entrega (de ${formatarInteiro(k.total)} do período).`
          : "Base desta aba: cargas que já saíram para entrega."}
      </p>
      <GradeDeIndicadores max={5}>
        <KpiCard
          rotulo="CTRC romaneados"
          icone={Truck}
          neutro
          status="bom"
          valor={k ? formatarInteiro(base) : "—"}
          detalhe="Cargas que já saíram para entrega no período"
          dica="Base desta aba: cargas com saída para entrega registrada, dentro do período e filtros escolhidos."
        />
        <KpiCard
          rotulo="Entregues"
          icone={CircleCheck}
          neutro
          status="bom"
          valor={k ? formatarInteiro(k.entregue) : "—"}
          detalhe={k ? `de ${formatarInteiro(base)} romaneados` : ""}
          dica="Das cargas que já saíram para entrega, quantas foram entregues ao destinatário. Esta aba conta só quem já saiu para entrega — por isso o número é menor que o da tela de Performance, que conta todos os CTRCs do período."
          aoClicar={() => {
            aoAbrir({ recorte: "entregues" });
          }}
        />
        <KpiCard
          rotulo="Não entregues"
          icone={CircleX}
          neutro
          status="ruim"
          valor={k ? formatarInteiro(k.naoEntregue) : "—"}
          detalhe={k ? pctBase(k.naoEntregue) : ""}
          dica="Cargas que saíram para entrega e até agora não foram entregues. Esta aba conta só quem já saiu para entrega — por isso o número é menor que o da tela de Performance, que conta todos os CTRCs do período."
          aoClicar={() => {
            aoAbrir({ recorte: "em_rota", status: "andamento" });
          }}
        />
        <KpiCard
          rotulo="Performance positiva"
          icone={ThumbsUp}
          neutro
          status="bom"
          valor={positiva !== null ? formatarPercentual(positiva, { escala: "cem" }) : "—"}
          detalhe={
            k && positiva !== null
              ? `${formatarInteiro(k.entregue)} de ${formatarInteiro(base)} entregues`
              : ""
          }
          dica="Entregues ÷ CTRC total da aba — a mesma Produtividade calculada mais abaixo."
          progresso={positiva !== null ? positiva / 100 : undefined}
        />
        <KpiCard
          rotulo="Performance negativa"
          icone={ThumbsDown}
          neutro
          status="ruim"
          valor={positiva !== null ? formatarPercentual(100 - positiva, { escala: "cem" }) : "—"}
          detalhe={
            k && positiva !== null
              ? `${formatarInteiro(base - k.entregue)} de ${formatarInteiro(base)} não entregues`
              : ""
          }
          dica="Contraponto da Performance positiva: 100% − Performance positiva."
        />
      </GradeDeIndicadores>
      <GradeDeIndicadores>
        <KpiCard
          rotulo="Entregas prejudicadas"
          icone={TriangleAlert}
          neutro
          status="alerta"
          valor={k ? formatarInteiro(k.prejudicada) : "—"}
          detalhe={prejuizoDe(k ? pctBase(k.prejudicada) : undefined)}
          dica="Cargas com prejuízo atribuído ao(s) código(s) indicado(s) no subtítulo. Usa a base completa de romaneados do período — o mesmo número da aba Prejuízo, dos cards do topo e da tela de Performance."
          aoClicar={() => {
            aoAbrir({ recorte: "prejuizo" });
          }}
        />
        <KpiCard
          rotulo="Frete perdido"
          icone={Banknote}
          neutro={!(k && k.fretePerdido > 0)}
          status="ruim"
          valor={k ? formatarMoeda(k.fretePerdido, { centavos: false }) : "—"}
          detalhe={prejuizoDe(
            k && k.freteRomaneado > 0
              ? `${formatarPercentual((k.fretePerdido / k.freteRomaneado) * 100, { escala: "cem" })} do frete da base desta aba`
              : undefined,
          )}
          dica="Frete das cargas com prejuízo atribuído ao(s) código(s) indicado(s) no subtítulo. Usa a base completa de romaneados do período — o mesmo valor da aba Prejuízo e da tela de Performance."
          aoClicar={() => {
            aoAbrir({ recorte: "prejuizo" });
          }}
        />
        <KpiCard
          rotulo="Prejuízo (%)"
          icone={Percent}
          neutro={!(pPrejuizo !== null && pPrejuizo > 0)}
          status="alerta"
          valor={pPrejuizo !== null ? formatarPercentual(pPrejuizo, { escala: "cem" }) : "—"}
          detalhe={prejuizoDe(
            k && pPrejuizo !== null
              ? `${formatarInteiro(k.prejudicada)} de ${formatarInteiro(base)} CTRC prejudicados`
              : undefined,
          )}
          dica="Mesmo cálculo de Entregas prejudicadas, em percentual: cargas com prejuízo atribuído ao(s) código(s) indicado(s) ÷ CTRC total da aba."
          aoClicar={() => {
            aoAbrir({ recorte: "prejuizo" });
          }}
        />
        <KpiCard
          rotulo="Entregas no horário (%)"
          icone={CalendarClock}
          neutro={!(pPrejuizo !== null && 100 - pPrejuizo >= 95)}
          status="bom"
          valor={pPrejuizo !== null ? formatarPercentual(100 - pPrejuizo, { escala: "cem" }) : "—"}
          detalhe={prejuizoDe(
            k && pPrejuizo !== null
              ? `${formatarInteiro(base - k.prejudicada)} de ${formatarInteiro(base)} CTRC no horário`
              : undefined,
          )}
          dica="Contraponto de Prejuízo (%): cargas sem prejuízo atribuído ao(s) código(s) indicado(s) ÷ CTRC total da aba. 100% − Prejuízo (%)."
        />
      </GradeDeIndicadores>
      <GraficoFretePerdido
        porHora={prejuizo.data?.porHora ?? []}
        porDia={prejuizo.data?.porDia ?? []}
        diaUnico={filtros.inicio === filtros.fim}
        carregando={prejuizo.isLoading}
      />
      {/* Totalizadores do período: nesta aba ficam aqui embaixo, a pedido do cliente. */}
      <CardsDoPeriodo {...cards} />
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        Entregues e Não entregues consideram as cargas que já saíram para entrega. O card CTRC conta
        todo o período (inclusive o que ainda não saiu), por isso é maior que os cards de cima.
        Prejuízo usa a base completa de romaneados, igual às demais telas. Uma carga entra na base
        de saída quando há registro de saída do veículo, confirmação de entrega, algum evento de rua
        (tentativa, recusa, retorno, cliente ausente e afins) ou comprovante de entrega recebido —
        não só o registro formal de saída, que muitas vezes não é lançado.
      </p>
      <Distribuicao filtros={filtros} nomeCurto={nomeCurto} aoAbrir={aoAbrir} />
      <TabelaPorViagem filtros={filtros} aoAbrir={aoAbrir} />
    </>
  );
}
