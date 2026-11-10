import { formatarDataHora } from "@erp/shared/formatacao";
import { AlertTriangle } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/componentes/ui/tooltip";
import { cn } from "@/lib/utils";

const inteiro = new Intl.NumberFormat("pt-BR");

interface SeloAtualizacaoProps {
  /** Instante ISO da última importação aplicada; `null` = ainda não importado. */
  atualizadoEm: string | null | undefined;
  /** XMLs de CT-e aguardando casamento (chip de alerta quando há pendentes). */
  xmlAguardando?: { pendentes: number; expirados: number } | undefined;
  fuso?: string | undefined;
  className?: string | undefined;
}

/**
 * "Dados atualizados em dd/mm/aaaa hh:mm": horário da última importação dos arquivos do SSW
 * aplicada (o ciclo roda de 30 em 30 minutos). Quem usa busca o horário (a cada 60 s) e passa.
 * origem: components/common/SyncStatusBadge.tsx (sistema atual)
 */
export function SeloAtualizacao({
  atualizadoEm,
  xmlAguardando,
  fuso,
  className,
}: SeloAtualizacaoProps) {
  const texto = atualizadoEm
    ? `Dados atualizados em ${formatarDataHora(atualizadoEm, fuso)}`
    : "Aguardando a primeira importação";
  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground",
        className,
      )}
      aria-live="polite"
    >
      <span>{texto}</span>
      {xmlAguardando && xmlAguardando.pendentes > 0 && (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400"
              >
                <AlertTriangle className="h-3 w-3" aria-hidden />
                {inteiro.format(xmlAguardando.pendentes)} XML aguardando
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" className="max-w-[320px] text-white">
              <span className="text-[12px] text-white">
                XMLs de CT-e recebidos por FTP que ainda não encontraram o documento no BI2. A fila
                é reprocessada automaticamente e expira em 5 dias.
                {xmlAguardando.expirados > 0
                  ? ` ${inteiro.format(xmlAguardando.expirados)} já expiraram sem casar.`
                  : ""}
              </span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </p>
  );
}
