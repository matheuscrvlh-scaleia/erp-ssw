import { type FiltrosRomaneio } from "@erp/shared/contratos/romaneio";
import { formatarInteiro, formatarPercentual } from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { useState } from "react";

import { Alternador } from "@/componentes/comum/Alternador";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { InfoTip } from "@/componentes/comum/InfoTip";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { ItemDeLegenda, Painel } from "@/componentes/comum/Painel";
import { Skeleton } from "@/componentes/ui/skeleton";
import { cn } from "@/lib/utils";

import { consultaDistribuicao, consultaPerformanceCarros } from "./api";
import { type Abertura } from "./busca";
import {
  Cabecalho,
  CLASSE_CODIGO,
  CLASSE_NUMERO,
  CLASSE_TD,
  ComDica,
  EstadoDaTabela,
  propsDaLinha,
  TabelaPropria,
  Th,
  Trilho,
} from "./componentes";

type Visao = "codigo" | "placa";

const VISOES: readonly { valor: Visao; rotulo: string }[] = [
  { valor: "codigo", rotulo: "Por código" },
  { valor: "placa", rotulo: "Por carro" },
];

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
  const porCodigo = visao === "codigo";
  return (
    <Painel
      icone={BarChart3}
      titulo={
        <span className="inline-flex items-center gap-1.5">
          {porCodigo ? "Distribuição dos não finalizados" : "Performance por carro"}
          <InfoTip
            texto={
              porCodigo
                ? "Cada CT-e romaneado que ainda não foi finalizado (não entregue e sem baixa) conta uma vez, no seu código efetivo atual. O total das barras é igual ao card 'Não entregues' desta aba. As pendências que travam a finalização (cliente ou transportadora) aparecem em destaque. Clique numa barra para ver as cargas daquele código."
                : `Uma linha por motorista e placa do romaneio de entrega do SSW (ou do SSW Mobile, quando não há romaneio). Entregas = CT-es que saíram para entrega naquele carro no período. Entrega prejudicada = dessas, as que tiveram ocorrência penalizante da ${nomeCurto} nos códigos do filtro (padrão: 13). Performance = 100% − % Prejudicada. Clique numa linha para ver as cargas daquele motorista e placa.`
            }
          />
        </span>
      }
      barra={
        <>
          <Alternador
            rotulo="Agrupar distribuição por"
            tamanho="pequeno"
            opcoes={VISOES}
            valor={visao}
            aoMudar={setVisao}
          />
          {porCodigo && (
            <span className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
              <ItemDeLegenda cor="var(--brand)">Demais códigos</ItemDeLegenda>
              <ItemDeLegenda cor="var(--status-bad)">
                Pendência (cliente ou transportadora)
              </ItemDeLegenda>
            </span>
          )}
        </>
      }
    >
      {porCodigo ? (
        <BarrasPorCodigo filtros={filtros} aoAbrir={aoAbrir} />
      ) : (
        <TabelaCarros filtros={filtros} aoAbrir={aoAbrir} />
      )}
    </Painel>
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
