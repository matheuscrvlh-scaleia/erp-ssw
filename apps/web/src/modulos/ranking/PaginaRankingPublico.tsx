import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { consultaRankingPublico } from "./api";
import { EquipeMobileView } from "./EquipeMobileView";
import { isoLocal } from "./periodo";

/**
 * Link público do ranking da equipe (sem login). Período = mês corrente no navegador.
 * origem: routes/ranking.publico.$token.tsx (sistema atual)
 */
export function PaginaRankingPublico({ token }: { token: string }) {
  useEffect(() => {
    document.title = "Meu ranking";
  }, []);
  const periodo = useMemo(() => {
    const d = new Date();
    return {
      inicio: isoLocal(new Date(d.getFullYear(), d.getMonth(), 1)),
      fim: isoLocal(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
      rotulo: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    };
  }, []);
  const { data, isLoading, error } = useQuery(
    consultaRankingPublico(token, periodo.inicio, periodo.fim),
  );

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>;
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h2 className="text-lg font-semibold">Link inválido ou expirado</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Solicite um novo link ao gestor da sua equipe.
        </p>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-background">
      <EquipeMobileView
        equipeNome={data.equipe.nome}
        periodoRotulo={periodo.rotulo}
        calculo={data.calculo}
        posicao={data.posicao}
        totalEquipes={data.totalEquipes}
        top3={data.top3}
      />
    </div>
  );
}
