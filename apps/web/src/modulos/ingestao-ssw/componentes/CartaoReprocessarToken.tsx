import { formatarInteiro } from "@erp/shared/formatacao";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";
import { toast } from "sonner";

import { Painel } from "@/componentes/comum/Painel";
import { Button } from "@/componentes/ui/button";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";

import { mutacaoReprocessarTokenIncorreto } from "../api";

export function CartaoReprocessarToken() {
  const queryClient = useQueryClient();
  const reprocessar = useMutation({
    ...mutacaoReprocessarTokenIncorreto(queryClient, (r) => {
      if (r.total === 0) toast.info("Nenhum evento rejeitado por token com conteúdo guardado.");
      else
        toast.success(
          `${formatarInteiro(r.enfileirados)} evento(s) reenviado(s) para processamento.`,
        );
    }),
    onError: (e) =>
      toast.error("Não foi possível reprocessar", { description: mensagemAmigavel(e) }),
  });
  return (
    <Painel
      icone={RotateCw}
      titulo="Reprocessar webhooks rejeitados por token"
      classeDoCorpo="space-y-4 p-5"
    >
      <p className="text-[13px] text-muted-foreground">
        Reenvia ao processamento os eventos recusados com &quot;token incorreto&quot; que guardaram
        o conteúdo recebido e cujo token é o segredo atual ou o anterior. Use depois de corrigir o
        segredo do webhook.
      </p>
      <Button
        size="sm"
        onClick={() => {
          reprocessar.mutate();
        }}
        disabled={reprocessar.isPending}
      >
        <RotateCw className={cn(reprocessar.isPending && "motion-safe:animate-spin")} aria-hidden />
        {reprocessar.isPending ? "Reenviando…" : "Reprocessar agora"}
      </Button>
      {reprocessar.data && (
        <p className="text-[13px] tabular-nums">
          Total: {formatarInteiro(reprocessar.data.total)} · Reenviados:{" "}
          {formatarInteiro(reprocessar.data.enfileirados)}
        </p>
      )}
    </Painel>
  );
}
