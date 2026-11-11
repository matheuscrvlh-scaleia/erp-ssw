import { FUSO_DO_NEGOCIO } from "@erp/dominio/nucleo/tempo";
import { hojeNoFuso } from "@erp/shared/datas";
import { useQuery } from "@tanstack/react-query";
import { Link2Off } from "lucide-react";
import { useEffect, useMemo } from "react";

import { aplicarPaleta, ultimaCorDaMarca } from "@/acesso/marca";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { Skeleton } from "@/componentes/ui/skeleton";

import { consultaRankingPublico } from "./api";
import { EquipeMobileView } from "./EquipeMobileView";
import { mesDe, periodoDoMes } from "./periodo";

/**
 * Link público do ranking da equipe (sem login). Período = mês corrente no dia de Brasília (Q11;
 * sem login não há empresa ativa para dar o fuso). A resposta não traz a cor da empresa: vale a
 * última usada neste navegador, como no login.
 * origem: routes/ranking.publico.$token.tsx (sistema atual)
 */
export function PaginaRankingPublico({ token }: { token: string }) {
  useEffect(() => {
    document.title = "Meu ranking";
  }, []);
  useEffect(() => aplicarPaleta(ultimaCorDaMarca()), []);
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-md items-center gap-2.5 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-[12px] font-bold text-primary-foreground">
            BI
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Painel BI</span>
          <span className="label-xs ml-auto">Meu ranking</span>
        </div>
      </header>
      <main className="mx-auto max-w-md space-y-4 px-4 py-6">
        {isLoading ? (
          <div className="space-y-4" aria-busy>
            <Skeleton className="h-12 w-2/3 rounded-md bg-muted" />
            <Skeleton className="h-40 w-full rounded-2xl bg-muted" />
            <Skeleton className="h-32 w-full rounded-2xl bg-muted" />
          </div>
        ) : error || !data ? (
          <div className="rounded-2xl border border-border bg-superficie p-1 shadow-cartao">
            <div className="rounded-xl border border-border bg-card">
              <EstadoVazio
                icone={Link2Off}
                mensagem="Link inválido ou expirado"
                detalhe="Solicite um novo link ao gestor da sua equipe."
              />
            </div>
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-[22px] leading-tight font-bold tracking-[-0.02em]">
                {data.equipe.nome}
              </h1>
              <p className="mt-1 text-[13px] text-muted-foreground">{periodo.rotulo}</p>
            </div>
            <EquipeMobileView
              calculo={data.calculo}
              posicao={data.posicao}
              totalEquipes={data.totalEquipes}
              top3={data.top3}
            />
          </>
        )}
      </main>
    </div>
  );
}
