import { RefreshCw } from "lucide-react";

import { Button } from "@/componentes/ui/button";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";

interface MensagemErroProps {
  erro: unknown;
  /** Prefixo, ex.: "Não foi possível carregar as coletas". */
  titulo?: string | undefined;
  /** Mostra "Tentar novamente" (ex.: `refetch` da consulta). */
  aoTentarDeNovo?: (() => void) | undefined;
  className?: string | undefined;
}

/**
 * Erro de consulta em texto para o operador: a mensagem da API (ex.: "A consulta demorou demais.
 * Reduza o período...") ou a genérica — nunca o texto técnico.
 */
export function MensagemErro({ erro, titulo, aoTentarDeNovo, className }: MensagemErroProps) {
  const mensagem = mensagemAmigavel(erro);
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-4 py-6 text-center text-[12px] text-[var(--status-bad)]",
        className,
      )}
    >
      <p>{titulo ? `${titulo}: ${mensagem}` : mensagem}</p>
      {aoTentarDeNovo && (
        <Button size="sm" variant="outline" className="h-7 text-[12px]" onClick={aoTentarDeNovo}>
          <RefreshCw className="mr-1.5 h-3 w-3" aria-hidden />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
