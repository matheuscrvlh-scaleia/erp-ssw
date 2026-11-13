import { formatarDataHora } from "@erp/shared/formatting";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { Pagina } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { chaves, consultaEventosWebhook } from "./api";
import { CartaoBi2 } from "./components/Bi2Card";
import { CartaoCredenciaisSsw } from "./components/SswCredentialsCard";
import { CartaoEventosWebhook } from "./components/WebhookEventsCard";

/**
 * Admin › Ingestão SSW (só a Plataforma, na empresa ativa): BI2 0017, credenciais da SSW API e
 * últimos eventos do webhook. Sem o cabeçalho explicativo nem os cards de backfill (Q41, Q45).
 * origem: routes/_authenticated/admin.ingestao.tsx (sistema atual)
 */
export function PaginaIngestao() {
  const queryClient = useQueryClient();
  const eventos = useQuery(consultaEventosWebhook);
  const atualizando = useIsFetching({ queryKey: chaves.tudo }) > 0;
  const ultima = eventos.data?.ultimaAtividade ?? null;
  return (
    <Pagina
      titulo="Ingestão SSW"
      descricao={
        <>
          Última atividade do webhook:{" "}
          {ultima ? formatarDataHora(ultima) : "nenhum evento recebido ainda"}
        </>
      }
      acoes={
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void queryClient.invalidateQueries({ queryKey: chaves.tudo })}
          disabled={atualizando}
        >
          <RefreshCw className={cn(atualizando && "motion-safe:animate-spin")} aria-hidden />
          Atualizar
        </Button>
      }
    >
      <CartaoBi2 />
      <CartaoCredenciaisSsw />
      <CartaoEventosWebhook />
    </Pagina>
  );
}
