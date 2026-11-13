import { type SaidaDe } from "@erp/shared/contract";
import { type contratosPrazoParceiro } from "@erp/shared/contracts/partner-deadline";
import { formatarInteiro, formatarPercentual } from "@erp/shared/formatting";
import { ChevronRight } from "lucide-react";

import { type ColunaTabela } from "@/components/common/data-table";
import { TabelaDados } from "@/components/common/DataTable";
import { SeloStatus } from "@/components/common/StatusBadge";
import { cn } from "@/lib/utils";

import { type Sla, tomDoSla } from "../rules";
import { SELO_DO_SLA } from "../texts";

type LinhaDoRanking = SaidaDe<typeof contratosPrazoParceiro.visaoGeral>["ranking"][number];

/** Top 10 dos parceiros com mais prazos inviáveis; a linha abre o detalhe do parceiro. */
export function TabelaRankingDeParceiros({
  ranking,
  sla,
  carregando,
  erro,
  aoTentarDeNovo,
  aoAbrir,
}: {
  ranking: readonly LinhaDoRanking[];
  sla: Sla;
  carregando: boolean;
  erro: unknown;
  aoTentarDeNovo: () => void;
  aoAbrir: (p: LinhaDoRanking) => void;
}) {
  const colunasDoRanking: ColunaTabela<LinhaDoRanking>[] = [
    {
      chave: "nome",
      titulo: "Parceiro",
      celula: (p) => (
        <span className="flex flex-col">
          <span className="font-semibold text-foreground">{p.nome}</span>
          {p.usaSsw && <span className="text-xs text-muted-foreground">usa SSW</span>}
        </span>
      ),
    },
    { chave: "total", titulo: "CTRCs", formato: "inteiro" },
    {
      chave: "qtdParceiro",
      titulo: "Prazo do parceiro",
      alinhamento: "direita",
      celula: (p) => (
        <>
          {formatarInteiro(p.qtdParceiro)}{" "}
          <span className="text-muted-foreground">
            ({formatarPercentual(p.pctParceiro, { casas: 0 })})
          </span>
        </>
      ),
    },
    {
      chave: "nascidosAtrasados",
      titulo: "Nascidos em atraso",
      alinhamento: "direita",
      celula: (p) => (
        <span className={cn(p.pctNascidos > 0.1 && "font-semibold text-status-bad-fg")}>
          {formatarInteiro(p.nascidosAtrasados)}{" "}
          <span className="opacity-75">({formatarPercentual(p.pctNascidos, { casas: 0 })})</span>
        </span>
      ),
    },
    {
      chave: "performanceComParceiro",
      titulo: "Performance",
      alinhamento: "direita",
      celula: (p) => (
        <SeloStatus tom={SELO_DO_SLA[tomDoSla(p.performanceComParceiro, sla)]}>
          {formatarPercentual(p.performanceComParceiro)}
        </SeloStatus>
      ),
    },
    {
      chave: "abrir",
      titulo: "",
      ordenavel: false,
      alinhamento: "direita",
      celula: () => <ChevronRight className="inline h-4 w-4 text-muted-foreground" aria-hidden />,
    },
  ];

  return (
    <TabelaDados
      titulo="Parceiros com mais prazos inviáveis no período"
      colunas={colunasDoRanking}
      linhas={ranking.slice(0, 10)}
      chaveDaLinha={(p) => p.id}
      aoClicarLinha={aoAbrir}
      carregando={carregando}
      erro={erro}
      aoTentarDeNovo={aoTentarDeNovo}
      mensagemVazia="Sem dados no período."
      porPagina={0}
      rotuloTotal={() => "Top 10 — clique para abrir o detalhe do parceiro"}
    />
  );
}
