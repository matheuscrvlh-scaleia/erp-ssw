import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/componentes/ui/button";

import { consultaCalculoDaEquipe } from "./api";
import { EquipeMobileView } from "./EquipeMobileView";

/** origem: routes/_authenticated/ranking.equipe.$id.tsx (sistema atual) */
export function PaginaEquipeDetalhe({
  id,
  busca,
}: {
  id: string;
  busca: { inicio: string; fim: string; regra: string };
}) {
  const { data, error } = useQuery(consultaCalculoDaEquipe(id, busca));
  if (error) {
    return <div className="p-8 text-center text-sm text-destructive">{error.message}</div>;
  }
  if (!data) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>;
  }
  return (
    <div>
      <div className="px-4 pt-4">
        <Button asChild size="sm" variant="ghost">
          <Link to="/admin/equipes">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>
      <EquipeMobileView
        equipeNome={data.equipeNome}
        periodoRotulo={`${busca.inicio} → ${busca.fim}`}
        calculo={data.calculo}
        posicao={null}
        totalEquipes={data.totalEquipes}
        top3={[]}
      />
    </div>
  );
}
