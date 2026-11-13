import { type SaidaDe } from "@erp/shared/contract";
import { type contratosPrazoParceiro } from "@erp/shared/contracts/partner-deadline";
import { formatarInteiro, formatarPercentual } from "@erp/shared/formatting";
import { ArrowRight, Clock4, TrendingDown, TrendingUp } from "lucide-react";

import { InfoTip } from "@/components/common/InfoTip";
import { Painel } from "@/components/common/Panel";
import { SeloStatus } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type VisaoGeral = SaidaDe<typeof contratosPrazoParceiro.visaoGeral>;

/** Quantos CT-e nasceram em atraso no período, com a variação e o atalho para a lista. */
export function PainelNascidosEmAtraso({
  nomeCurto,
  carregando,
  totais: t,
  comparacao: a,
  aoVerLista,
}: {
  nomeCurto: string;
  carregando: boolean;
  totais: VisaoGeral["totais"] | undefined;
  comparacao: VisaoGeral["comparacao"] | undefined;
  aoVerLista: () => void;
}) {
  return (
    <Painel
      titulo={
        <span className="inline-flex items-center gap-1.5">
          Nascidos em atraso
          <InfoTip
            texto={`CTRCs emitidos a menos de 48 horas (corridas) da previsão de entrega. A ${nomeCurto} não teria como cumprir: o atraso é do parceiro. CTRCs da TROCA ficam fora da conta. Só compara prazos — ocorrências, inclusive as de responsabilidade do cliente, não entram.`}
          />
        </span>
      }
      descricao="Emitido a menos de 48 horas da previsão de entrega"
      icone={Clock4}
      classeDoCorpo="px-5 py-4"
      rodape={
        <Button size="sm" variant="ghost" className="-ml-2 text-brand" onClick={aoVerLista}>
          Ver lista <ArrowRight aria-hidden />
        </Button>
      }
    >
      {carregando ? (
        <Skeleton className="h-20 rounded-lg bg-muted" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="num-hero text-foreground">
              {formatarInteiro(t?.nascidosAtrasados ?? 0)}
            </span>
            {a && a.deltaNascidos !== 0 && (
              <SeloStatus
                tom={a.deltaNascidos > 0 ? "erro" : "sucesso"}
                icone={a.deltaNascidos > 0 ? TrendingUp : TrendingDown}
              >
                {a.deltaNascidos > 0 ? `+${String(a.deltaNascidos)}` : a.deltaNascidos} vs período
                anterior
              </SeloStatus>
            )}
          </div>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            CTRC(s) no período
            {t?.pctNascidos != null && (
              <> · {formatarPercentual(t.pctNascidos, { casas: 0 })} dos CTRCs avaliados</>
            )}
          </p>
        </>
      )}
    </Painel>
  );
}
