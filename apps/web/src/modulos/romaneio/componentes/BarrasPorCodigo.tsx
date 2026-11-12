/** Distribuição dos não finalizados por código efetivo (uma barra por código). */
import { type FiltrosRomaneio } from "@erp/shared/contratos/romaneio";
import { formatarInteiro, formatarPercentual } from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";

import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Skeleton } from "@/componentes/ui/skeleton";
import { cn } from "@/lib/utils";

import { consultaDistribuicao } from "../api";
import { type Abertura } from "../busca";
import { ComDica } from "./ComDica";
import { Trilho } from "./Trilho";

export function BarrasPorCodigo({
  filtros,
  aoAbrir,
}: {
  filtros: FiltrosRomaneio;
  aoAbrir: (a: Abertura) => void;
}) {
  const q = useQuery(consultaDistribuicao(filtros));
  // Todos os códigos aparecem; o rótulo leva a descrição (um código com 1 CT-e no fim da lista
  // passava despercebido só com o número).
  const barras = (q.data ?? []).map((r) => ({
    ...r,
    rotulo:
      r.codigo !== null
        ? `#${r.codigo} ${(r.descricao ?? "").trim().slice(0, 28)}`.trim()
        : "s/ cód",
  }));
  const total = barras.reduce((s, r) => s + r.qtd, 0);
  const maior = Math.max(1, ...barras.map((b) => b.qtd));
  return (
    <div className="px-5 py-4">
      <p className="text-[12.5px] text-muted-foreground">
        {q.isLoading
          ? "carregando…"
          : `${formatarInteiro(total)} CT-es não finalizados em ${formatarInteiro(barras.length)} códigos${
              barras.length > 16 ? " · role a lista para ver todos" : ""
            } · clique numa barra para filtrar`}
      </p>
      <div className="rolagem-fina mt-3 max-h-[400px] overflow-y-auto pr-1">
        {q.isError ? (
          <MensagemErro erro={q.error} aoTentarDeNovo={() => void q.refetch()} />
        ) : q.isLoading ? (
          <div className="space-y-2.5" aria-hidden>
            {[90, 60, 40, 25, 12].map((w) => (
              <Skeleton key={w} className="h-5 rounded-md bg-muted" style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : barras.length === 0 ? (
          <EstadoVazio mensagem="Nenhum CT-e não finalizado no recorte atual." />
        ) : (
          <ul className="space-y-0.5">
            {barras.map((b) => {
              const codigo = b.codigo;
              const cor = b.pendencia ? "var(--status-bad)" : "var(--brand)";
              return (
                <li key={b.rotulo}>
                  <ComDica
                    texto={`${formatarInteiro(b.qtd)} CTRCs — ${b.descricao ?? "sem descrição"} (${formatarPercentual(b.qtd / Math.max(1, total))} dos não finalizados)`}
                  >
                    <button
                      type="button"
                      disabled={codigo === null}
                      onClick={() => {
                        if (codigo !== null)
                          aoAbrir({ codigos: [codigo], recorte: "em_rota", status: "andamento" });
                      }}
                      className="group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-[12.5px] enabled:cursor-pointer enabled:hover:bg-muted/60 disabled:cursor-default"
                    >
                      <span
                        className={cn(
                          "w-[130px] shrink-0 truncate text-right sm:w-[220px]",
                          b.pendencia && "font-semibold",
                        )}
                      >
                        {b.rotulo}
                      </span>
                      <Trilho fracao={b.qtd / maior} cor={cor} className="h-3 flex-1" />
                      <span className="w-12 shrink-0 text-right font-semibold tabular-nums">
                        {formatarInteiro(b.qtd)}
                      </span>
                    </button>
                  </ComDica>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
