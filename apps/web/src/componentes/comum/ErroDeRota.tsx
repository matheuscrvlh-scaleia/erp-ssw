import { MENSAGEM_RECARREGAR } from "@erp/shared/erros";
import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/componentes/ui/button";
import { ehChunkObsoleto } from "@/lib/versao";

function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error && erro.message ? erro.message : "Erro desconhecido.";
}

export function ErroDeRota({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const obsoleto = ehChunkObsoleto(error);
  const tentarDeNovo = () => {
    if (obsoleto) {
      window.location.reload();
      return;
    }
    void router.invalidate();
    reset();
  };
  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-cartao">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-status-warn-bg">
        <AlertTriangle className="h-5 w-5 text-status-warn-fg" />
      </div>
      <h2 className="text-[16px] font-bold tracking-tight">
        Não foi possível carregar esta página
      </h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        {obsoleto ? MENSAGEM_RECARREGAR : mensagemDoErro(error)}
      </p>
      <div className="mt-4">
        <Button size="sm" variant="outline" onClick={tentarDeNovo}>
          <RefreshCw aria-hidden />
          {obsoleto ? "Recarregar" : "Tentar novamente"}
        </Button>
      </div>
    </div>
  );
}
