import { formatarInteiro, formatarPercentual } from "@erp/shared/formatting";
import { FileText, Gauge, Handshake, MapPin, TrendingDown } from "lucide-react";

import { KpiCard } from "@/components/common/KpiCard";

import { type FiltroDoCard, type kpisDoRanking, nivelDoSla } from "../rules";

/** Indicadores do topo; cada card filtra a tabela (o do SLA e o de abaixo da meta alternam). */
export function CardsDoRanking({
  grupo,
  kpis,
  meta,
  alerta,
  plural,
  rotuloDoPeriodo,
  filtroCard,
  aoVerTodos,
  aoAlternar,
}: {
  grupo: "pagador" | "cidade";
  kpis: ReturnType<typeof kpisDoRanking>;
  meta: number;
  alerta: number;
  plural: string;
  rotuloDoPeriodo: string;
  filtroCard: FiltroDoCard;
  aoVerTodos: () => void;
  aoAlternar: (filtro: FiltroDoCard) => void;
}) {
  const statusDoSlaMedio = nivelDoSla(kpis.slaMedio, meta, alerta);
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        rotulo={grupo === "pagador" ? "Parceiros" : "Cidades"}
        valor={formatarInteiro(kpis.grupos)}
        status="bom"
        neutro
        icone={grupo === "pagador" ? Handshake : MapPin}
        detalhe="no período · ver todos"
        aoClicar={() => {
          aoVerTodos();
        }}
        ativo={filtroCard === "todos"}
      />
      <KpiCard
        rotulo="CT-e no período"
        valor={formatarInteiro(kpis.totalCtes)}
        status="bom"
        neutro
        icone={FileText}
        detalhe={rotuloDoPeriodo}
        aoClicar={() => {
          aoVerTodos();
        }}
        ativo={filtroCard === "todos"}
      />
      <KpiCard
        rotulo="SLA médio"
        valor={formatarPercentual(kpis.slaMedio)}
        status={statusDoSlaMedio ?? "bom"}
        neutro={statusDoSlaMedio === null}
        progresso={kpis.slaMedio ?? undefined}
        icone={Gauge}
        detalhe={`meta ${formatarPercentual(meta)} · ver os que atingem`}
        aoClicar={() => {
          aoAlternar("na_meta");
        }}
        ativo={filtroCard === "na_meta"}
      />
      <KpiCard
        rotulo="Abaixo da meta"
        valor={formatarInteiro(kpis.abaixoMeta)}
        status={kpis.abaixoMeta > 0 ? "ruim" : "bom"}
        icone={TrendingDown}
        detalhe={`de ${formatarInteiro(kpis.grupos)} ${plural}`}
        aoClicar={() => {
          aoAlternar("abaixo_meta");
        }}
        ativo={filtroCard === "abaixo_meta"}
      />
    </div>
  );
}
