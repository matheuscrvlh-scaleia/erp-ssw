import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { Aviso } from "@/components/common/Notice";
import { Pagina } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { mensagemAmigavel } from "@/lib/error-message";
import { cn } from "@/lib/utils";

import { chaves, consultaDiagnostico } from "./api";
import { CartaoJobs } from "./components/JobsCard";
import { CartaoOrfaos } from "./components/OrphansCard";
import { CartaoReprocessarToken } from "./components/ReprocessTokenCard";
import { CartaoCredenciaisSsw } from "./components/SswCredentialsCard";
import { CartaoWebhook } from "./components/WebhookCard";

/**
 * Plataforma › Diagnóstico SSW (empresa ativa): situação dos jobs no BullMQ, webhook nas últimas
 * 24 h e 7 dias, órfãos e o teste do token. As sincronizações ficam em Logs.
 * origem: routes/_authenticated/admin.ssw-diagnostico.tsx (sistema atual)
 */
export function PaginaDiagnostico() {
  const queryClient = useQueryClient();
  const consulta = useQuery(consultaDiagnostico);
  const atualizando = useIsFetching({ queryKey: chaves.tudo }) > 0;
  const d = consulta.data;
  return (
    <Pagina
      titulo="Diagnóstico SSW"
      descricao="Situação dos jobs de ingestão, do webhook e do token da SSW API na empresa ativa."
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
      {consulta.error && (
        <Aviso
          tom="erro"
          titulo="Não foi possível carregar o diagnóstico"
          acao={
            <Button size="sm" variant="outline" onClick={() => void consulta.refetch()}>
              <RefreshCw aria-hidden />
              Tentar novamente
            </Button>
          }
        >
          {mensagemAmigavel(consulta.error)}
        </Aviso>
      )}
      {d && <CartaoWebhook webhook={d.webhook} />}
      {d && <CartaoOrfaos orfaos={d.orfaos} />}
      <CartaoJobs
        jobs={d?.jobs ?? []}
        disponivel={d?.filasDisponiveis ?? true}
        carregando={consulta.isLoading}
      />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <CartaoCredenciaisSsw />
        <CartaoReprocessarToken />
      </div>
    </Pagina>
  );
}
