import { verificarParticao } from "@erp/dominio/performance/tela";
import { type BlocoProducao } from "@erp/shared/contratos/performance";
import { formatarInteiro } from "@erp/shared/formatacao";
import { AlertTriangle, CircleCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/** Entregues + Finalizado em Sistema + Previstos = Emitidos. */
export function VerificacaoDaParticao({
  bloco,
  ignorarPeriodo,
}: {
  bloco: BlocoProducao;
  ignorarPeriodo: boolean;
}) {
  const { soma, diferenca } = verificarParticao(bloco);
  return (
    <p
      className={cn(
        "flex items-start gap-2 text-[12.5px]",
        diferenca === 0 ? "text-muted-foreground" : "text-status-warn-fg",
      )}
    >
      {diferenca === 0 ? (
        <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-status-good" aria-hidden />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      )}
      <span>
        <strong className="font-semibold text-foreground">Verificação:</strong> Entregues (
        {formatarInteiro(bloco.entregues)}) + Finalizado em Sistema (
        {formatarInteiro(bloco.finalizadoSistema)}) + Previstos no período (
        {formatarInteiro(bloco.previstos)}) ={" "}
        <strong className="font-semibold text-foreground">{formatarInteiro(soma)}</strong> de{" "}
        {formatarInteiro(bloco.totalCtrcs)} CT-e emitidos{" "}
        {diferenca === 0
          ? "— partição fecha 100%."
          : `— diferença de ${formatarInteiro(Math.abs(diferenca))} CTRC.`}
        {ignorarPeriodo && (
          <>
            {" "}
            O bloco Previstos acima está em{" "}
            <strong className="font-semibold">&quot;Todos em aberto&quot;</strong> e mostra um
            número maior; esta verificação usa sempre os previstos emitidos no período.
          </>
        )}
      </span>
    </p>
  );
}
