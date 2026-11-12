import { formatarInteiro } from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";

import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { cn } from "@/lib/utils";

import { consultaMotivos } from "../api";
import { type PropsDaAba } from "../busca";
import { BarrasCarregando } from "./BarrasCarregando";
import { ComDica } from "./ComDica";
import { TituloDoBloco } from "./TituloDoBloco";
import { Trilho } from "./Trilho";

/** Principais motivos de não entrega (só pendências do cliente ou da transportadora). */
export function MotivosNaoEntrega({ filtros, aoAbrir }: PropsDaAba) {
  const q = useQuery(consultaMotivos(filtros));
  const linhas = q.data ?? [];
  const maior = Math.max(1, ...linhas.map((r) => r.qtd));
  return (
    <Painel
      icone={TriangleAlert}
      titulo={
        <TituloDoBloco dica="Principais motivos que impediram a entrega no período — pendências do cliente ou da operação. Uma mesma carga pode aparecer em mais de um motivo. Clique num motivo para ver as cargas.">
          Motivos de não entrega
        </TituloDoBloco>
      }
      descricao="somente ocorrências classificadas como pendência (cliente ou transportadora)"
      classeDoCorpo="px-3 py-3"
    >
      {q.isLoading && <BarrasCarregando />}
      {q.isError && <MensagemErro erro={q.error} aoTentarDeNovo={() => void q.refetch()} />}
      {q.isSuccess && linhas.length === 0 && (
        <EstadoVazio mensagem="Nenhuma ocorrência de insucesso no período." />
      )}
      <ul className="space-y-0.5">
        {linhas.map((r) => {
          // 13 (entrega prejudicada) é o motivo acompanhado de perto pela operação.
          const codigo = Number(r.codigo);
          const destaque = codigo === 13;
          return (
            <li key={r.codigo}>
              <ComDica texto={`${r.codigo} · ${r.descricao || "—"}: ${formatarInteiro(r.qtd)}`}>
                <button
                  type="button"
                  onClick={() => {
                    if (Number.isInteger(codigo)) aoAbrir({ codigos: [codigo] });
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-muted/60",
                    destaque && "bg-status-bad-bg font-semibold text-status-bad-fg",
                  )}
                >
                  <span className="inline-flex w-[52px] shrink-0 items-center gap-1 font-mono text-[12px]">
                    {destaque && <TriangleAlert className="h-3.5 w-3.5" aria-hidden />}
                    <span className={cn(!destaque && "text-muted-foreground")}>{r.codigo}</span>
                  </span>
                  <span className="min-w-0 flex-1 truncate">{r.descricao || "—"}</span>
                  <Trilho
                    fracao={r.qtd / maior}
                    cor={destaque ? "var(--status-bad)" : "var(--brand)"}
                    className="w-[72px] shrink-0 sm:w-[140px]"
                  />
                  <span className="w-[52px] shrink-0 text-right tabular-nums">
                    {formatarInteiro(r.qtd)}
                  </span>
                </button>
              </ComDica>
            </li>
          );
        })}
      </ul>
    </Painel>
  );
}
