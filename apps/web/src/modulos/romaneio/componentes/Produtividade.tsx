import { type LinhaPerformancePessoa } from "@erp/shared/contratos/romaneio";
import { formatarInteiro, formatarPercentual } from "@erp/shared/formatacao";
import { CircleCheck, Undo2 } from "lucide-react";

import { KpiCard } from "@/componentes/comum/KpiCard";

import { pctDe } from "../regras";
import { TIP_RETORNO } from "../textos";

/** Produtividade (entregues ÷ total da aba) e Taxa de retorno (código 13 em aberto). */
export function Produtividade({ linhas }: { linhas: readonly LinhaPerformancePessoa[] }) {
  const entregues = linhas.reduce((s, r) => s + r.entregues, 0);
  const total = linhas.reduce((s, r) => s + r.romaneados, 0);
  const retornos = linhas.reduce((s, r) => s + r.retornos, 0);
  const pct = pctDe(entregues, total);
  const pctRetorno = pctDe(retornos, total);
  return (
    <>
      <p className="text-[13px] text-muted-foreground">
        Base desta aba: {formatarInteiro(total)} CTRC no total — {formatarInteiro(entregues)}{" "}
        entregues. Cargas ainda em rota contam contra a produtividade até terem desfecho.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard
          rotulo="Produtividade"
          icone={CircleCheck}
          neutro={!(pct !== null && pct >= 95)}
          status="bom"
          valor={pct !== null ? formatarPercentual(pct, { escala: "cem" }) : "—"}
          detalhe={
            pct !== null
              ? `${formatarInteiro(entregues)} de ${formatarInteiro(total)} CTRC entregues`
              : ""
          }
          progresso={pct !== null ? pct / 100 : undefined}
          dica="Entregues ÷ CTRC total da aba (entregues + não entregues/em rota + finalizado em sistema). Cargas em rota contam contra até terem desfecho."
        />
        <KpiCard
          rotulo="Taxa de retorno"
          icone={Undo2}
          neutro={retornos === 0}
          status="ruim"
          valor={pctRetorno !== null ? formatarPercentual(pctRetorno, { escala: "cem" }) : "—"}
          detalhe={
            pctRetorno !== null
              ? `${formatarInteiro(retornos)} CTRC sem entrega · de ${formatarInteiro(total)} da aba`
              : ""
          }
          dica={TIP_RETORNO}
        />
      </div>
    </>
  );
}
