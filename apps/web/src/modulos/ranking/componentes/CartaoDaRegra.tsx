import { type SaidaDe } from "@erp/shared/contrato";
import { type contratosRanking as c, type Regra } from "@erp/shared/contratos/ranking";
import { formatarMoeda } from "@erp/shared/formatacao";
import { CalendarRange, Copy, Edit, Sparkles, Trash2 } from "lucide-react";

import { Painel } from "@/componentes/comum/Painel";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { Button } from "@/componentes/ui/button";

import { ROTULO_DO_CRITERIO } from "../textos";

/** Cartão de uma regra: vigência, critérios, ações e a simulação do mês anterior. */
export function CartaoDaRegra({
  regra: r,
  simulacao: sim,
  simulando,
  podeEditar,
  podeExcluir,
  aoSimular,
  aoEditar,
  aoCopiar,
  aoExcluir,
}: {
  regra: Regra;
  /** A última simulação, quando é desta regra. */
  simulacao: SaidaDe<typeof c.simularRegra> | null;
  simulando: boolean;
  podeEditar: boolean;
  podeExcluir: boolean;
  aoSimular: () => void;
  aoEditar: () => void;
  aoCopiar: () => void;
  aoExcluir: () => void;
}) {
  return (
    <Painel
      titulo={
        <span className="flex flex-wrap items-center gap-2">
          {r.nome}
          <SeloStatus tom={r.ativo ? "sucesso" : "neutro"}>
            {r.ativo ? "Ativa" : "Inativa"}
          </SeloStatus>
        </span>
      }
      descricao={r.descricao}
      acoes={
        <>
          <Button size="sm" variant="outline" onClick={aoSimular} disabled={simulando}>
            <Sparkles aria-hidden /> Simular
          </Button>
          {podeEditar && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                aria-label="Editar regra"
                title="Editar regra"
                onClick={aoEditar}
              >
                <Edit aria-hidden />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                aria-label="Copiar regra"
                title="Copiar regra"
                onClick={aoCopiar}
              >
                <Copy aria-hidden />
              </Button>
            </>
          )}
          {podeExcluir && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-status-bad-fg hover:text-status-bad-fg"
              aria-label="Remover regra"
              title="Remover regra"
              onClick={aoExcluir}
            >
              <Trash2 aria-hidden />
            </Button>
          )}
        </>
      }
      classeDoCorpo="space-y-3 px-5 py-4"
    >
      <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <CalendarRange className="h-4 w-4 shrink-0" aria-hidden />
        <span className="tabular-nums">
          Vigência: {r.vigenciaInicio} {r.vigenciaFim ? `→ ${r.vigenciaFim}` : "→ aberta"}
        </span>
      </p>
      {r.criterios.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {r.criterios.map((k) => (
            <span
              key={k.id}
              className="inline-flex h-6 items-center rounded-full border border-border bg-muted px-2.5 text-xs font-medium text-foreground"
            >
              {ROTULO_DO_CRITERIO[k.criterio]}
            </span>
          ))}
        </div>
      )}

      {sim && (
        <div className="rounded-xl border border-brand/30 bg-brand-suave p-3 text-[13px]">
          <div className="font-semibold text-brand">Simulação (mês anterior)</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {sim.equipes.length} equipe(s) · Total estimado:{" "}
            <span className="font-bold text-foreground tabular-nums">
              {formatarMoeda(sim.equipes.reduce((s, e) => s + e.valorCalculado, 0))}
            </span>
          </div>
          <div className="mt-2 divide-y divide-border">
            {sim.equipes.slice(0, 5).map((e) => (
              <div key={e.equipeId} className="flex justify-between gap-3 py-1.5 text-xs">
                <span>{e.nome}</span>
                <span className="font-semibold tabular-nums">
                  {formatarMoeda(e.valorCalculado)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Painel>
  );
}
