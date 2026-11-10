import { type FiltrosRomaneio } from "@erp/shared/contratos/romaneio";
import { formatarInteiro, formatarPercentual } from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { InfoTip } from "@/componentes/comum/InfoTip";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";

import { consultaDistribuicao, consultaPerformanceCarros } from "./api";
import { type Abertura } from "./busca";

type Visao = "codigo" | "placa";

/** % de entregas prejudicadas; a Performance é o complemento (100 − %). */
const pctPrejudicada = (r: { romaneados: number; prejudicadas: number }) =>
  r.romaneados > 0 ? (100 * r.prejudicadas) / r.romaneados : 0;

/**
 * Distribuição dos CT-e romaneados ainda não finalizados por código efetivo e, em "Por carro",
 * a performance por motorista + placa.
 */
export function Distribuicao({
  filtros,
  nomeCurto,
  aoAbrir,
}: {
  filtros: FiltrosRomaneio;
  nomeCurto: string;
  aoAbrir: (a: Abertura) => void;
}) {
  const [visao, setVisao] = useState<Visao>("codigo");
  return (
    <div className="rounded-[10px] border border-border/70 bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>
            {visao === "codigo" ? "Distribuição dos não finalizados" : "Performance por carro"}
          </span>
          <InfoTip
            texto={
              visao === "codigo"
                ? "Cada CT-e romaneado que ainda não foi finalizado (não entregue e sem baixa) conta uma vez, no seu código efetivo atual. O total das barras é igual ao card 'Não entregues' desta aba. As pendências que travam a finalização (cliente ou transportadora) aparecem em destaque. Clique numa barra para ver as cargas daquele código."
                : `Uma linha por motorista e placa do romaneio de entrega do SSW (ou do SSW Mobile, quando não há romaneio). Entregas = CT-es que saíram para entrega naquele carro no período. Entrega prejudicada = dessas, as que tiveram ocorrência penalizante da ${nomeCurto} nos códigos do filtro (padrão: 13). Performance = 100% − % Prejudicada. Clique numa linha para ver as cargas daquele motorista e placa.`
            }
          />
        </div>
        <div
          role="group"
          aria-label="Agrupar distribuição por"
          className="flex rounded-md border border-border/70 p-0.5"
        >
          {(["codigo", "placa"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={visao === v}
              onClick={() => {
                setVisao(v);
              }}
              className={cn(
                "rounded-[5px] px-2 py-0.5 text-[10px] uppercase tracking-wide transition-colors",
                visao === v
                  ? "bg-[var(--brand)] text-white"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {v === "codigo" ? "Por código" : "Por carro"}
            </button>
          ))}
        </div>
      </div>
      {visao === "placa" ? (
        <TabelaCarros filtros={filtros} aoAbrir={aoAbrir} />
      ) : (
        <BarrasPorCodigo filtros={filtros} aoAbrir={aoAbrir} />
      )}
    </div>
  );
}

function BarrasPorCodigo({
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
    <>
      <div className="text-[10px] text-muted-foreground/80">
        {q.isLoading
          ? "carregando…"
          : `${formatarInteiro(total)} CT-es não finalizados em ${formatarInteiro(barras.length)} códigos${
              barras.length > 16 ? " · role a lista para ver todos" : ""
            } · clique numa barra para filtrar`}
      </div>
      <div className="mt-2 max-h-[400px] overflow-y-auto">
        {q.isError ? (
          <div className="py-8 text-center text-[11px] text-[var(--status-bad)]">
            {mensagemAmigavel(q.error)}
          </div>
        ) : !q.isLoading && barras.length === 0 ? (
          <div className="py-8 text-center text-[11px] text-muted-foreground">
            Nenhum CT-e não finalizado no recorte atual.
          </div>
        ) : (
          <ul className="space-y-1">
            {barras.map((b) => {
              const codigo = b.codigo;
              return (
                <li key={b.rotulo}>
                  <button
                    type="button"
                    disabled={codigo === null}
                    title={`${formatarInteiro(b.qtd)} CTRCs — ${b.descricao ?? "sem descrição"}`}
                    onClick={() => {
                      if (codigo !== null)
                        aoAbrir({ codigos: [codigo], recorte: "em_rota", status: "andamento" });
                    }}
                    className="flex w-full items-center gap-2 text-left text-[10px] enabled:cursor-pointer enabled:hover:bg-muted/50"
                  >
                    <span className="w-[210px] shrink-0 truncate text-right">{b.rotulo}</span>
                    <span className="h-[18px] flex-1">
                      <span
                        className="block h-full rounded-sm"
                        style={{
                          // Barra mínima visível: código com 1 CT-e ao lado de outro com mil some.
                          width: `max(3px, ${(b.qtd / maior) * 100}%)`,
                          background: b.pendencia ? "var(--status-bad)" : "var(--brand)",
                        }}
                      />
                    </span>
                    <span className="w-10 shrink-0 tabular-nums">{formatarInteiro(b.qtd)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

/**
 * Motorista | Placa | Entregas | Entrega prejudicada | Performance | % Prejudicada, pela % pior
 * primeiro, com total. A linha sem placa (saiu sem romaneio de entrega) vai por último e não abre.
 */
function TabelaCarros({
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
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] text-muted-foreground/80">
          {q.isLoading
            ? "carregando…"
            : `${formatarInteiro(linhas.length)} carros · clique numa linha para ver as cargas`}
        </div>
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
      <div className="mt-2 max-h-[400px] overflow-y-auto rounded-md border border-border/50">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-muted text-muted-foreground">
            <tr className="border-b border-border/70">
              <th className="px-3 py-1.5 text-left font-normal">Motorista</th>
              <th className="px-3 py-1.5 text-left font-normal">Placa</th>
              <th className="px-3 py-1.5 text-right font-normal">Entregas</th>
              <th className="px-3 py-1.5 text-right font-normal">Entrega prejudicada</th>
              <th className="px-3 py-1.5 text-right font-normal">Performance</th>
              <th className="px-3 py-1.5 text-right font-normal">% Prejudicada</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  carregando…
                </td>
              </tr>
            )}
            {!q.isLoading && linhas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                  Nenhum carro com saída para entrega no período.
                </td>
              </tr>
            )}
            {linhas.map((r) => {
              const pct = pctPrejudicada(r);
              const placa = r.placa;
              return (
                <tr
                  key={`${r.motorista}|${placa ?? ""}`}
                  {...(placa
                    ? {
                        onClick: () => {
                          aoAbrir({ motorista: r.motorista, placa });
                        },
                      }
                    : {})}
                  className={cn(
                    "border-b border-border/40 last:border-0",
                    placa && "cursor-pointer hover:bg-muted/40",
                  )}
                >
                  <td className="px-3 py-1">
                    {placa ? (
                      r.motorista
                    ) : (
                      <span className="text-muted-foreground">Sem romaneio de entrega</span>
                    )}
                  </td>
                  <td className="px-3 py-1 font-mono text-[11px]">{placa ?? "—"}</td>
                  <td className="px-3 py-1 text-right tabular-nums">
                    {formatarInteiro(r.romaneados)}
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums">
                    {formatarInteiro(r.prejudicadas)}
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums">
                    {formatarPercentual(100 - pct, { escala: "cem", casas: 2 })}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-1 text-right font-medium tabular-nums",
                      r.prejudicadas > 0 && "text-[var(--status-bad)]",
                    )}
                  >
                    {formatarPercentual(pct, { escala: "cem", casas: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {!q.isLoading && linhas.length > 0 && (
            <tfoot className="sticky bottom-0 bg-muted font-medium">
              <tr className="border-t border-border/70">
                <td className="px-3 py-1.5" colSpan={2}>
                  Total
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {formatarInteiro(total.romaneados)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {formatarInteiro(total.prejudicadas)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {formatarPercentual(100 - pctPrejudicada(total), { escala: "cem", casas: 2 })}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {formatarPercentual(pctPrejudicada(total), { escala: "cem", casas: 2 })}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
