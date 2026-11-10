import { FUSO_DO_NEGOCIO } from "@erp/dominio/nucleo/tempo";
import { hojeNoFuso } from "@erp/shared/datas";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { consultaRankingPublico } from "./api";
import { EquipeMobileView } from "./EquipeMobileView";
import { mesDe, periodoDoMes } from "./periodo";

/**
 * Link público do ranking da equipe (sem login). Período = mês corrente no dia de Brasília (Q11;
 * sem login não há empresa ativa para dar o fuso).
 * origem: routes/ranking.publico.$token.tsx (sistema atual)
 */
export function PaginaRankingPublico({ token }: { token: string }) {
  useEffect(() => {
    document.title = "Meu ranking";
  }, []);
  const periodo = useMemo(() => {
    const mes = mesDe(hojeNoFuso(FUSO_DO_NEGOCIO));
    return {
      ...periodoDoMes(mes),
      rotulo: new Date(`${mes}-01T12:00:00Z`).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
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
