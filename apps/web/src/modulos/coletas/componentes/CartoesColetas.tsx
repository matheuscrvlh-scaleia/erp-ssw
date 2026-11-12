import { type StatusDaLista, type TotaisDeColetas } from "@erp/shared/contratos/coletas";
import { formatarInteiro, formatarParticipacao } from "@erp/shared/formatacao";
import {
  AlarmClockOff,
  Ban,
  Boxes,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  FileText,
  Hourglass,
  type LucideIcon,
} from "lucide-react";

import { KpiCard, type StatusKpi } from "@/componentes/comum/KpiCard";

import { type BuscaColetas } from "../busca";

interface Cartao {
  status: StatusDaLista;
  rotulo: string;
  valor: (t: TotaisDeColetas) => number;
  detalhe: (t: TotaisDeColetas) => string;
  dica: string;
  tom: StatusKpi;
  icone: LucideIcon;
}

const CARTOES: Cartao[] = [
  {
    status: "todas",
    icone: Boxes,
    rotulo: "Coletas",
    valor: (t) => t.total,
    detalhe: (t) => `${formatarInteiro(t.reversas)} reversa(s)`,
    dica: "Coletas cadastradas no período (data de cadastro no SSW), em qualquer situação.",
    tom: "bom",
  },
  {
    status: "no_prazo",
    icone: CalendarCheck,
    rotulo: "Coletadas no prazo",
    valor: (t) => t.noPrazo,
    detalhe: (t) =>
      `${formatarParticipacao(t.noPrazo, t.coletadas)} das ${formatarInteiro(t.coletadas)} coletadas`,
    dica: "Coletadas até a data/hora limite atual da coleta. É a mesma conta do quadro RESUMO do relatório 050 do SSW.",
    tom: "bom",
  },
  {
    status: "atrasadas",
    icone: CalendarX,
    rotulo: "Coletadas atrasadas",
    valor: (t) => t.atrasadas,
    detalhe: (t) => `${formatarParticipacao(t.atrasadas, t.coletadas)} das coletadas`,
    dica: "Coletadas depois da data/hora limite atual. Coleta com prazo alterado no SSW conta pelo prazo novo, como no próprio SSW.",
    tom: "ruim",
  },
  {
    status: "abertas",
    icone: Hourglass,
    rotulo: "Em aberto",
    valor: (t) => t.abertas,
    detalhe: (t) =>
      `${formatarInteiro(t.cadastradas)} cadastradas · ${formatarInteiro(t.comandadas)} comandadas`,
    dica: "Ainda não coletadas nem canceladas, na última posição recebida do SSW.",
    tom: "alerta",
  },
  {
    status: "vencidas",
    icone: AlarmClockOff,
    rotulo: "Vencidas",
    valor: (t) => t.vencidas,
    detalhe: () => "Em aberto com o limite já passado",
    dica: "Coletas em aberto cuja data/hora limite já passou.",
    tom: "ruim",
  },
  {
    status: "vence_hoje",
    icone: CalendarClock,
    rotulo: "Vencem hoje",
    valor: (t) => t.venceHoje,
    detalhe: (t) => `${formatarInteiro(t.aVencer)} a vencer depois de hoje`,
    dica: "Coletas em aberto com data limite hoje, ainda dentro do horário.",
    tom: "alerta",
  },
  {
    status: "com_ctrc",
    icone: FileText,
    rotulo: "Com CT-e gerado",
    valor: (t) => t.comCtrc,
    detalhe: (t) => `${formatarParticipacao(t.comCtrc, t.coletadas)} das coletadas`,
    dica: "Coletas em que o SSW registrou 'CTRC GERADO' no histórico: o subcontrato que nasceu da coleta.",
    tom: "bom",
  },
  {
    status: "canceladas",
    icone: Ban,
    rotulo: "Canceladas",
    valor: (t) => t.canceladas,
    detalhe: (t) => `${formatarInteiro(t.prejudicadas)} prejudicada(s) pelo horário`,
    dica: "Coletas canceladas no SSW, mesmo que tenham sido coletadas antes. Não entram na conta de prazo.",
    tom: "ruim",
  },
];

/** Os cartões do painel; clicar filtra a lista pela situação (de novo: volta a todas). */
export function CartoesColetas({
  totais,
  status,
  aoMudar: mudar,
}: {
  /** Ausente enquanto o painel carrega: o cartão mostra a dica no lugar do detalhe. */
  totais: TotaisDeColetas | undefined;
  status: StatusDaLista;
  aoMudar: (m: Partial<BuscaColetas>) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {CARTOES.map((c) => (
        <KpiCard
          key={c.status}
          rotulo={c.rotulo}
          valor={totais ? formatarInteiro(c.valor(totais)) : "—"}
          detalhe={totais ? c.detalhe(totais) : c.dica}
          status={c.tom}
          neutro={c.status === "todas"}
          icone={c.icone}
          ativo={status === c.status && c.status !== "todas"}
          aoClicar={() => {
            mudar({ status: status === c.status ? "todas" : c.status });
          }}
        />
      ))}
    </div>
  );
}
