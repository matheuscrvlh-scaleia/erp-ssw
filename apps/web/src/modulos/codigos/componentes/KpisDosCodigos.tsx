import { type EstatisticasDoCatalogo } from "@erp/shared/contratos/codigos-ocorrencia";
import { formatarInteiro, formatarPercentual } from "@erp/shared/formatacao";
import { Hourglass, Inbox, ListChecks, Target } from "lucide-react";

import { KpiCard, type StatusKpi } from "@/componentes/comum/KpiCard";

function statusDaPrecisao(p: number): StatusKpi {
  return p > 0.95 ? "bom" : p > 0.8 ? "alerta" : "ruim";
}

/** Os quatro cartões do catálogo (zerados enquanto a lista carrega). */
export function KpisDosCodigos({
  estatisticas,
}: {
  estatisticas: EstatisticasDoCatalogo | undefined;
}) {
  const precisao = estatisticas?.precisao ?? 1;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        rotulo="Classificados"
        valor={`${formatarInteiro(estatisticas?.classificados ?? 0)} / ${formatarInteiro(estatisticas?.total ?? 0)}`}
        status="bom"
        icone={ListChecks}
        detalhe="Códigos com responsável e penaliza definidos"
      />
      <KpiCard
        rotulo="Pendentes de classificação"
        valor={formatarInteiro(estatisticas?.pendentes ?? 0)}
        status={(estatisticas?.pendentes ?? 0) > 0 ? "alerta" : "bom"}
        icone={Hourglass}
        detalhe="Códigos novos ou marcados para revisar"
      />
      <KpiCard
        rotulo="Ocorrências aguardando"
        valor={formatarInteiro(estatisticas?.ocorrenciasEmPendentes ?? 0)}
        status={(estatisticas?.ocorrenciasEmPendentes ?? 0) > 0 ? "alerta" : "bom"}
        icone={Inbox}
        detalhe="Ocorrências em códigos pendentes"
      />
      <KpiCard
        rotulo="Precisão do cálculo"
        valor={formatarPercentual(precisao)}
        status={statusDaPrecisao(precisao)}
        icone={Target}
        detalhe="Ocorrências de 30 dias em códigos já classificados"
        progresso={precisao}
      />
    </div>
  );
}
