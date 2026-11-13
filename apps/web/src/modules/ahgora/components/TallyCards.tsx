import { type FuncionarioApurado } from "@erp/shared/contracts/ahgora";
import { CalendarCheck, CalendarClock, Clock, UsersRound } from "lucide-react";

import { KpiCard } from "@/components/common/KpiCard";

import { totaisDaApuracao } from "../rules";
import { formatarHoras } from "../texts";

/** Os quatro cards do topo da apuração. */
export function CardsDaApuracao({ funcionarios }: { funcionarios: FuncionarioApurado[] }) {
  const totais = totaisDaApuracao(funcionarios);
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        rotulo="Colaboradores"
        valor={String(funcionarios.length)}
        status="bom"
        neutro
        icone={UsersRound}
        detalhe="na apuração"
      />
      <KpiCard
        rotulo="Dias com registro"
        valor={String(totais.diasComRegistro)}
        status="bom"
        neutro
        icone={CalendarCheck}
        detalhe="somados de todos"
      />
      <KpiCard
        rotulo="Horas apuradas"
        valor={formatarHoras(totais.minutos)}
        status="bom"
        neutro
        icone={Clock}
        detalhe="só dias que fecharam"
      />
      <KpiCard
        rotulo="Dias a revisar"
        valor={String(totais.revisar)}
        status={totais.revisar > 0 ? "alerta" : "bom"}
        icone={CalendarClock}
        detalhe={totais.revisar > 0 ? "fora das horas apuradas" : "nenhum dia pendente"}
      />
    </div>
  );
}
