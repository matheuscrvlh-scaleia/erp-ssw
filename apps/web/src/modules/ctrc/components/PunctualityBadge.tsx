import { type DetalheCtrc } from "@erp/shared/contracts/ctrc";
import { Clock } from "lucide-react";

import { SeloStatus } from "@/components/common/StatusBadge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { pontualidade } from "../texts";

export function SeloDePontualidade({ ctrc }: { ctrc: DetalheCtrc }) {
  const p = pontualidade({
    noPrazo: ctrc.noPrazo,
    responsabilidadeCliente: ctrc.responsabilidadeCliente,
    dataEntrega: ctrc.dataEntrega,
    baixado: ctrc.finalizacao.baixa !== null,
  });
  if (p === "responsabilidade_cliente") {
    return <SeloStatus tom="info">Responsabilidade cliente</SeloStatus>;
  }
  if (p === "baixado") {
    return <SeloStatus tom="neutro">Baixado sem entrega — fora da pontualidade</SeloStatus>;
  }
  if (p === "no_prazo") return <SeloStatus tom="sucesso">No prazo</SeloStatus>;
  if (p === "fora_do_prazo") return <SeloStatus tom="erro">Fora do prazo</SeloStatus>;
  const emTransito = p === "em_transito";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex max-w-full cursor-help rounded-full">
          <SeloStatus tom="neutro" icone={Clock}>
            {emTransito ? "Em trânsito — pontualidade não apurada" : "Pontualidade em apuração"}
          </SeloStatus>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[280px] text-xs leading-snug">
        {emTransito
          ? "A pontualidade é apurada depois da entrega, comparando a data de entrega com a previsão dos relatórios do SSW."
          : "A entrega já foi registrada; a pontualidade é recalculada pelos relatórios do SSW a cada 30 minutos. Se continuar assim, falta a previsão de entrega deste CT-e."}
      </TooltipContent>
    </Tooltip>
  );
}
