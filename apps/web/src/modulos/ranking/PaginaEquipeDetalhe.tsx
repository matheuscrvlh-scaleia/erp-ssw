import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { Skeleton } from "@/componentes/ui/skeleton";

import { consultaCalculoDaEquipe } from "./api";
import { ResumoDaEquipe } from "./componentes/ResumoDaEquipe";

/** origem: routes/_authenticated/ranking.equipe.$id.tsx (sistema atual) */
export function PaginaEquipeDetalhe({
  id,
  busca,
}: {
  id: string;
  busca: { inicio: string; fim: string; regra: string };
}) {
  const { data, error, refetch } = useQuery(consultaCalculoDaEquipe(id, busca));
  return (
    <Pagina
      titulo={
        data?.equipeNome ??
        (error ? "Ranking da equipe" : <Skeleton className="h-7 w-56 rounded-md bg-muted" />)
      }
      descricao={`${busca.inicio} → ${busca.fim}`}
      largura="estreita"
      acoes={
        <Button asChild size="sm" variant="ghost">
          <Link to="/admin/configuracoes" search={{ aba: "equipes" }}>
            <ArrowLeft aria-hidden /> Voltar
          </Link>
        </Button>
      }
    >
      {error ? (
        <Painel>
          <MensagemErro erro={error} aoTentarDeNovo={() => void refetch()} />
        </Painel>
      ) : !data ? (
        <div className="mx-auto max-w-md space-y-4" aria-busy>
          <Skeleton className="h-40 w-full rounded-2xl bg-muted" />
          <Skeleton className="h-24 w-full rounded-2xl bg-muted" />
        </div>
      ) : (
        <ResumoDaEquipe
          calculo={data.calculo}
          posicao={null}
          totalEquipes={data.totalEquipes}
          top3={[]}
        />
      )}
    </Pagina>
  );
}
