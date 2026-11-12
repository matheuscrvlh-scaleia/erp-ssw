import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { Aviso } from "@/componentes/comum/Aviso";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";

import { chaves, consultaDiagnostico } from "./api";
import { CartaoCredenciaisSsw } from "./componentes/CartaoCredenciaisSsw";
import { CartaoJobs } from "./componentes/CartaoJobs";
import { CartaoOrfaos } from "./componentes/CartaoOrfaos";
import { CartaoReprocessarToken } from "./componentes/CartaoReprocessarToken";
import { CartaoSincronizacoes } from "./componentes/CartaoSincronizacoes";
import { CartaoWebhook } from "./componentes/CartaoWebhook";

/**
 * Plataforma › Diagnóstico SSW (empresa ativa): situação dos jobs no BullMQ, últimas
 * sincronizações, webhook nas últimas 24 h e 7 dias, órfãos e o teste do token.
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
      <CartaoSincronizacoes linhas={d?.sincronizacoes ?? []} carregando={consulta.isLoading} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <CartaoCredenciaisSsw />
        <CartaoReprocessarToken />
      </div>
    </Pagina>
  );
}
