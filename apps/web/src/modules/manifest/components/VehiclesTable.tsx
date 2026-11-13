import { type FiltrosRomaneio } from "@erp/shared/contracts/manifest";
import { formatarInteiro, formatarPercentual } from "@erp/shared/formatting";
import { useQuery } from "@tanstack/react-query";

import { ExportMenu } from "@/components/common/ExportMenu";
import { cn } from "@/lib/utils";

import { consultaPerformanceCarros } from "../api";
import { pctPrejudicada } from "../rules";
import { type Abertura } from "../search";
import { CLASSE_CODIGO, CLASSE_NUMERO, CLASSE_TD } from "../texts";
import { Cabecalho } from "./Header";
import { propsDaLinha, TabelaPropria } from "./OwnTable";
import { EstadoDaTabela } from "./TableState";
import { Th } from "./Th";

/**
 * Motorista | Placa | Entregas | Entrega prejudicada | Performance | % Prejudicada, pela % pior
 * primeiro, com total. A linha sem placa (saiu sem romaneio de entrega) vai por último e não abre.
 */
export function TabelaCarros({
  filtros,
  aoAbrir,
}: {
  filtros: FiltrosRomaneio;
  aoAbrir: (a: Abertura) => void;
}) {
  const q = useQuery(consultaPerformanceCarros(filtros));
  const linhas = [...(q.data ?? [])].sort((a, b) => {
    const semA = a.placa === null ? 1 : 0;
    const semB = b.placa === null ? 1 : 0;
    return semA - semB || pctPrejudicada(b) - pctPrejudicada(a) || b.romaneados - a.romaneados;
  });
  const total = {
    romaneados: linhas.reduce((s, r) => s + r.romaneados, 0),
    prejudicadas: linhas.reduce((s, r) => s + r.prejudicadas, 0),
  };
  return (
    <>
      <div className="flex items-center justify-between gap-2 px-5 py-3">
        <p className="text-[12.5px] text-muted-foreground">
          {q.isLoading
            ? "carregando…"
            : `${formatarInteiro(linhas.length)} carros · clique numa linha para ver as cargas`}
        </p>
        <ExportMenu
          arquivo="romaneio-performance-carro"
          titulo="Performance por carro"
          colunas={[
            { chave: "motoristaExibido", titulo: "Motorista" },
            { chave: "placa", titulo: "Placa" },
            { chave: "romaneados", titulo: "Entregas", formato: "inteiro" },
            { chave: "prejudicadas", titulo: "Entrega prejudicada", formato: "inteiro" },
            { chave: "performance", titulo: "Performance (%)", formato: "percentual" },
            { chave: "prejudicada", titulo: "% Prejudicada", formato: "percentual" },
          ]}
          linhas={linhas.map((r) => ({
            ...r,
            motoristaExibido: r.placa ? r.motorista : "Sem romaneio de entrega",
            performance: (100 - pctPrejudicada(r)) / 100,
            prejudicada: pctPrejudicada(r) / 100,
          }))}
          soIcone
        />
      </div>
      <TabelaPropria className="max-h-[440px] overflow-y-auto border-t border-border">
        <Cabecalho fixo>
          <Th>Motorista</Th>
          <Th>Placa</Th>
          <Th direita>Entregas</Th>
          <Th direita>Entrega prejudicada</Th>
          <Th direita>Performance</Th>
          <Th direita>% Prejudicada</Th>
        </Cabecalho>
        <tbody>
          <EstadoDaTabela
            colunas={6}
            carregando={q.isLoading}
            erro={q.error}
            aoTentarDeNovo={() => void q.refetch()}
            vazio={linhas.length === 0}
            mensagem="Nenhum carro com saída para entrega no período."
          />
          {linhas.map((r) => {
            const pct = pctPrejudicada(r);
            const placa = r.placa;
            return (
              <tr
                key={`${r.motorista}|${placa ?? ""}`}
                {...propsDaLinha(
                  placa
                    ? () => {
                        aoAbrir({ motorista: r.motorista, placa });
                      }
                    : undefined,
                )}
              >
                <td className={CLASSE_TD}>
                  {placa ? (
                    r.motorista
                  ) : (
                    <span className="text-muted-foreground">Sem romaneio de entrega</span>
                  )}
                </td>
                <td className={CLASSE_CODIGO}>{placa ?? "—"}</td>
                <td className={CLASSE_NUMERO}>{formatarInteiro(r.romaneados)}</td>
                <td className={CLASSE_NUMERO}>{formatarInteiro(r.prejudicadas)}</td>
                <td className={CLASSE_NUMERO}>
                  {formatarPercentual(100 - pct, { escala: "cem", casas: 2 })}
                </td>
                <td
                  className={cn(
                    CLASSE_NUMERO,
                    "font-semibold",
                    r.prejudicadas > 0 && "text-status-bad-fg",
                  )}
                >
                  {formatarPercentual(pct, { escala: "cem", casas: 2 })}
                </td>
              </tr>
            );
          })}
        </tbody>
        {!q.isLoading && linhas.length > 0 && (
          <tfoot className="sticky bottom-0 bg-muted font-semibold">
            <tr className="border-t border-border">
              <td className={CLASSE_TD} colSpan={2}>
                Total
              </td>
              <td className={CLASSE_NUMERO}>{formatarInteiro(total.romaneados)}</td>
              <td className={CLASSE_NUMERO}>{formatarInteiro(total.prejudicadas)}</td>
              <td className={CLASSE_NUMERO}>
                {formatarPercentual(100 - pctPrejudicada(total), { escala: "cem", casas: 2 })}
              </td>
              <td className={CLASSE_NUMERO}>
                {formatarPercentual(pctPrejudicada(total), { escala: "cem", casas: 2 })}
              </td>
            </tr>
          </tfoot>
        )}
      </TabelaPropria>
    </>
  );
}
