import { type PainelPlataforma } from "@erp/shared/contratos/painel-plataforma";
import { formatarInteiro } from "@erp/shared/formatacao";
import { INFO_DA_INTEGRACAO } from "@erp/shared/plataforma";

import { emOperacao } from "../regras";

/** Quantas empresas em operação têm cada integração ligada (barra = parte das empresas). */
export function GraficoIntegracoes({ painel }: { painel: PainelPlataforma }) {
  const base = painel.empresas.filter(emOperacao).length;
  return (
    <ul className="space-y-3 px-5 py-4" aria-label="Integrações ligadas por empresa">
      {painel.integracoes.map((i) => {
        const fracao = base > 0 ? i.empresas / base : 0;
        return (
          <li key={i.tipo} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="truncate">{INFO_DA_INTEGRACAO[i.tipo].nome}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {formatarInteiro(i.empresas)} de {formatarInteiro(base)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted" aria-hidden>
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${String(Math.min(100, fracao * 100))}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
