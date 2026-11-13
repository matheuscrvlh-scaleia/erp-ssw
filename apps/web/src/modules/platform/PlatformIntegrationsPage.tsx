import { useQuery } from "@tanstack/react-query";

import { MensagemErro } from "@/components/common/ErrorMessage";
import { Painel } from "@/components/common/Panel";
import { Pagina } from "@/components/layout/Page";
import { Skeleton } from "@/components/ui/skeleton";

import { consultaIntegracoesDaPlataforma } from "./api";
import { CartaoDaPlataforma } from "./components/PlatformCard";

/**
 * Plataforma › Configurações › Integrações: domínio, e-mail (Resend) e worker-ssw, iguais para
 * todas as empresas.
 */
export function PaginaIntegracoesDaPlataforma() {
  const consulta = useQuery(consultaIntegracoesDaPlataforma);
  return (
    <Pagina
      titulo="Integrações"
      descricao="Configurações da Plataforma que valem para todas as empresas. Senhas e chaves ficam cifradas; salvar vale em segundos, sem reiniciar o sistema."
    >
      {consulta.isLoading && (
        <div role="status" aria-label="Carregando…" className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56 rounded-2xl bg-muted" />
          <Skeleton className="h-56 rounded-2xl bg-muted" />
        </div>
      )}
      {consulta.error && (
        <Painel>
          <MensagemErro erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()} />
        </Painel>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {consulta.data?.integracoes.map((i) => (
          <CartaoDaPlataforma key={i.tipo} integracao={i} />
        ))}
      </div>
    </Pagina>
  );
}
