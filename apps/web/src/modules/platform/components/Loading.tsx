import { MensagemErro } from "@/components/common/ErrorMessage";
import { Painel } from "@/components/common/Panel";
import { Skeleton } from "@/components/ui/skeleton";

/** Esqueleto enquanto a aba carrega e o erro dela, se houver. */
export function Carregando({ carregando, erro }: { carregando: boolean; erro: unknown }) {
  if (carregando) {
    return (
      <div role="status" aria-label="Carregando…" className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-40 rounded-2xl bg-muted" />
        <Skeleton className="h-40 rounded-2xl bg-muted" />
      </div>
    );
  }
  return erro ? (
    <Painel>
      <MensagemErro erro={erro} />
    </Painel>
  ) : null;
}
