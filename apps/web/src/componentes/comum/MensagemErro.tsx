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
        "flex flex-col items-center justify-center gap-3 px-4 py-8 text-center text-[13px] text-status-bad-fg",
        className,
      )}
    >
      <p>{titulo ? `${titulo}: ${mensagem}` : mensagem}</p>
      {aoTentarDeNovo && (
        <Button size="sm" variant="outline" onClick={aoTentarDeNovo}>
          <RefreshCw aria-hidden />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
