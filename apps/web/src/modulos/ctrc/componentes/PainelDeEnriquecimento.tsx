import { type DetalheCtrc } from "@erp/shared/contratos/ctrc";
import { formatarData, formatarDataHora } from "@erp/shared/formatacao";
import { Check, Database } from "lucide-react";

import { Painel } from "@/componentes/comum/Painel";

export function PainelDeEnriquecimento({ bi2, fuso }: { bi2: DetalheCtrc["bi2"]; fuso: string }) {
  return (
    <Painel titulo="Enriquecimento" icone={Database} classeDoCorpo="px-5 py-4">
      {bi2 ? (
        <div className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-status-good/40 bg-status-good-bg text-status-good-fg">
            <Check className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-[13px] font-semibold">BI2 — dados operacionais</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatarDataHora(bi2.atualizadoEm, fuso)}
              </span>
            </div>
            <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
              Relatório {bi2.codigoRelatorio} · referência {formatarData(bi2.dataAlvo)}. Trouxe NF,
              peso, volumes, placas, redespachante, cidade destino, valor do frete.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">Nenhum enriquecimento registrado ainda.</p>
      )}
    </Painel>
  );
}
