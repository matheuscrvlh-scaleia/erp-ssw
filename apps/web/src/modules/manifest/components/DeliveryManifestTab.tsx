/** Aba Romaneio de entrega. origem: features/romaneio/Fase2Views.tsx (sistema atual) */
import { formatarInteiro, formatarMoeda, formatarPeso } from "@erp/shared/formatting";
import { useQuery } from "@tanstack/react-query";
import { Car, FileText } from "lucide-react";

import { EstadoVazio } from "@/components/common/EmptyState";
import { MensagemErro } from "@/components/common/ErrorMessage";
import { ExportMenu } from "@/components/common/ExportMenu";
import { KpiCard } from "@/components/common/KpiCard";
import { Painel } from "@/components/common/Panel";
import { cn } from "@/lib/utils";

import { consultaCtesPorCarro, consultaKpis } from "../api";
import { type PropsDaAba } from "../search";
import { TituloDoBloco } from "./BlockTitle";
import { BarrasCarregando } from "./LoadingBars";
import { Trilho } from "./Rail";
import { ComDica } from "./WithHint";

export function AbaRomaneioEntrega({ filtros, aoAbrir }: PropsDaAba) {
  const kpis = useQuery(consultaKpis(filtros));
  const carros = useQuery(consultaCtesPorCarro(filtros));
  const linhas = carros.data ?? [];
  const maior = Math.max(1, ...linhas.map((c) => c.ctes));
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          rotulo="CTRC no período"
          icone={FileText}
          neutro
          status="bom"
          valor={kpis.data ? formatarInteiro(kpis.data.total) : "—"}
          detalhe="Base do período filtrado"
          dica="Todas as cargas do período e dos filtros escolhidos, sem as canceladas no mesmo dia. É a base dos percentuais desta aba."
          aoClicar={() => {
            aoAbrir({ recorte: "todos" });
          }}
        />
      </div>
      <Painel
        icone={Car}
        titulo={
          <TituloDoBloco dica="Todas as placas que levaram cargas para entrega no período, da que mais levou para a que menos levou. Com a base “saída para entrega”, a placa vem do próprio romaneio do dia (036). CT-e que contam como saída sem romaneio de veículo próprio (entrega por parceiro, agência ou baixa administrativa) ficam na última linha, “Sem placa identificada”. Clique numa placa para ver as cargas daquele veículo.">
            CTRC por carro
          </TituloDoBloco>
        }
        descricao={`${
          linhas.length > 0
            ? `${formatarInteiro(linhas.filter((c) => c.placa).length)} placas · `
            : ""
        }CTRC · peso · vol. · frete`}
        acoes={
          <ExportMenu
            arquivo="romaneio-ctrc-por-carro"
            titulo="CTRC por carro"
            colunas={[
              { chave: "placaExibida", titulo: "Placa" },
              { chave: "motorista", titulo: "Motorista" },
              { chave: "ctes", titulo: "CTRC", formato: "inteiro" },
              { chave: "peso", titulo: "Peso (kg)", formato: "decimal" },
              { chave: "volumes", titulo: "Volumes", formato: "inteiro" },
              { chave: "frete", titulo: "Frete", formato: "moeda" },
            ]}
            linhas={linhas.map((c) => ({
              ...c,
              placaExibida: c.placa ?? "Sem placa identificada",
            }))}
            soIcone
          />
        }
        classeDoCorpo="px-3 py-3"
      >
        {carros.isLoading && <BarrasCarregando />}
        {carros.isError && (
          <MensagemErro erro={carros.error} aoTentarDeNovo={() => void carros.refetch()} />
        )}
        {carros.isSuccess && linhas.length === 0 && (
          <EstadoVazio mensagem="Nenhum carro com saída para entrega no período." />
        )}
        {linhas.length > 0 && (
          <>
            <div className="flex items-center gap-3 px-2 pb-1.5 label-xs" aria-hidden>
              <span className="w-24 shrink-0">Placa</span>
              <span className="hidden w-44 shrink-0 md:inline">Motorista</span>
              <span className="flex-1" />
              <span className="w-14 shrink-0 text-right">CTRC</span>
              <span className="hidden w-20 shrink-0 text-right sm:inline">Peso</span>
              <span className="hidden w-16 shrink-0 text-right sm:inline">Vol.</span>
              <span className="w-24 shrink-0 text-right">Frete</span>
            </div>
            <ul className="rolagem-fina max-h-[520px] space-y-0.5 overflow-y-auto pr-1">
              {linhas.map((c) => {
                const placa = c.placa;
                const resumo = `${formatarInteiro(c.ctes)} CTRC · ${c.peso ? formatarPeso(c.peso, { fixas: true }) : "—"} · ${formatarInteiro(c.volumes)} vol. · ${formatarMoeda(c.frete, { centavos: false })}`;
                const conteudo = (
                  <>
                    <span
                      className={cn(
                        "w-24 shrink-0 text-[12px]",
                        placa ? "font-mono" : "text-muted-foreground italic",
                      )}
                    >
                      {placa ?? "Sem placa identificada"}
                    </span>
                    <span className="hidden w-44 shrink-0 truncate text-muted-foreground md:inline">
                      {c.motorista ?? "—"}
                    </span>
                    <Trilho fracao={c.ctes / maior} className="h-2.5 flex-1" />
                    <span className="w-14 shrink-0 text-right font-semibold tabular-nums">
                      {formatarInteiro(c.ctes)}
                    </span>
                    <span className="hidden w-20 shrink-0 text-right text-muted-foreground tabular-nums sm:inline">
                      {c.peso ? formatarPeso(c.peso, { fixas: true }) : "—"}
                    </span>
                    <span className="hidden w-16 shrink-0 text-right text-muted-foreground tabular-nums sm:inline">
                      {formatarInteiro(c.volumes)}
                    </span>
                    <span className="w-24 shrink-0 text-right text-muted-foreground tabular-nums">
                      {formatarMoeda(c.frete, { centavos: false })}
                    </span>
                  </>
                );
                const classe =
                  "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-[13px]";
                return (
                  <li key={placa ?? "__sem_placa__"}>
                    {placa ? (
                      <ComDica texto={`${placa} · ${resumo}`}>
                        <button
                          type="button"
                          onClick={() => {
                            aoAbrir({ placa });
                          }}
                          className={cn(classe, "hover:bg-muted/60")}
                        >
                          {conteudo}
                        </button>
                      </ComDica>
                    ) : (
                      <div
                        className={classe}
                        title="CT-e que contam como saída para entrega sem romaneio de veículo próprio no período (entrega por parceiro, agência ou baixa administrativa)."
                      >
                        {conteudo}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Painel>
    </>
  );
}
