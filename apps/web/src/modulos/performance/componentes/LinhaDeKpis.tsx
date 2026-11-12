import { statusDoOtif, statusDoRetorno, statusDoSla } from "@erp/dominio/performance/tela";
import {
  type ConfiguracaoPerformance,
  type Otif,
  type Pontualidade,
  type ResumoPerformance,
} from "@erp/shared/contratos/performance";
import { formatarInteiro, formatarPercentual } from "@erp/shared/formatacao";
import {
  AlarmClock,
  ArrowRight,
  CalendarClock,
  Gauge,
  PackageSearch,
  RotateCcw,
} from "lucide-react";

import { KpiCard } from "@/componentes/comum/KpiCard";
import { Painel } from "@/componentes/comum/Painel";
import { cn } from "@/lib/utils";

import { ComDica } from "./ComDica";
import { DistribuicaoPontualidade } from "./DistribuicaoPontualidade";

interface AcoesDosKpis {
  emAtraso: () => void;
  emAtrasoFr: () => void;
  emAtrasoCliente: () => void;
  nascidos: () => void;
  otif: () => void;
}

/** Textos do card de SLA Operacional quando ainda não há percentual. */
function semSlaOperacional(t: Pontualidade["totais"] | undefined): string {
  const total = t?.total ?? 0;
  if (total > 0 && t?.excluidoCliente === total) {
    return "Todos os CTRCs no período são responsabilidade do cliente";
  }
  if (total > 0 && (t?.semInfoBi2 ?? 0) > 0) return "Aguardando dados de pontualidade do BI2";
  return total === 0 ? "Sem CTRCs no período" : "Aguardando dados do BI2";
}

const DICA_DO_ATRASO = (nomeCurto: string) =>
  "CT-e cuja última ocorrência efetiva não é finalizadora (fora dos códigos de baixa) e cujo prazo de entrega vigente já venceu. " +
  "Considera o prazo atualizado no SSW, não o original. O total conta todos (rastreio geral); logo abaixo é separado por responsabilidade: " +
  `os que aguardam cliente/parceiro continuam sendo rastreados, mas não refletem falha operacional da ${nomeCurto}. CT-e sem prazo definido não é avaliado.`;

/**
 * Indicadores do período (SLA Operacional, Nascidos em atraso, OTIF, Taxa de retorno, Em Atraso)
 * e, abaixo, a distribuição da pontualidade e o Em Atraso por responsabilidade.
 */
export function LinhaDeKpis({
  resumo,
  pontualidade,
  otif,
  configuracao,
  nomeCurto,
  acoes,
}: {
  resumo: ResumoPerformance;
  pontualidade: Pontualidade | undefined;
  otif: Otif | undefined;
  configuracao: ConfiguracaoPerformance;
  nomeCurto: string;
  acoes: AcoesDosKpis;
}) {
  const meta = configuracao.slaMetaPct / 100;
  const alerta = configuracao.slaAlertaAmareloPct / 100;
  const t = pontualidade?.totais;
  const r = resumo.totais;
  const metaTaxa = resumo.metaTaxaRetorno;
  const taxa = r.taxaRetorno;
  const acimaDaMeta = metaTaxa != null && taxa > metaTaxa;

  const slaOp = t?.performancePct ?? null;
  const nascPct = t?.nascidosPct ?? null;
  const nascQtd = t?.nascidosAtraso ?? 0;
  const nascAvaliados = t?.nascidosAvaliados ?? 0;
  const foraDaConta = Math.max(0, (t?.total ?? 0) - nascAvaliados);
  const nascSub =
    nascPct != null
      ? `${formatarInteiro(nascQtd)} de ${formatarInteiro(nascAvaliados)} CTRCs chegaram com prazo menor que o padrão${foraDaConta > 0 ? ` · ${formatarInteiro(foraDaConta)} fora da conta (TROCA ou sem previsão)` : ""}`
      : (t?.total ?? 0) === 0
        ? "Sem CTRCs no período"
        : "Nenhum CTRC do período pode ser avaliado";

  const otifPct = otif?.pct ?? null;
  const temAtraso = r.ctrcsEmAtraso > 0;
  const mostrarDistribuicao = slaOp != null && t !== undefined;

  return (
    <>
      <div
        className={cn(
          "grid gap-4 sm:grid-cols-2",
          configuracao.otifVisivel ? "lg:grid-cols-3 xl:grid-cols-5" : "xl:grid-cols-4",
        )}
      >
        <ComDica dica="CT-e emitidos menos os entregues fora do prazo, sobre os CT-e emitidos. Fora do prazo exclui responsabilidade do cliente.">
          <KpiCard
            rotulo="SLA Operacional"
            icone={Gauge}
            valor={slaOp != null ? formatarPercentual(slaOp, { separador: "." }) : "—"}
            status={slaOp != null ? statusDoSla(slaOp, meta, alerta) : "bom"}
            neutro={slaOp == null}
            progresso={slaOp ?? undefined}
            detalhe={
              slaOp != null
                ? `meta ${formatarPercentual(meta, { separador: "." })}`
                : semSlaOperacional(t)
            }
          />
        </ComDica>
        <ComDica
          dica={`CTRCs emitidos a menos de 48 horas da previsão de entrega (horas corridas: fim de semana e feriado contam). Ex.: emitido na terça com previsão para quarta. Nesses casos a ${nomeCurto} não tinha como cumprir: o atraso é do parceiro. CTRCs da TROCA ficam fora da conta. Só compara prazos — ocorrências, inclusive as de responsabilidade do cliente, não entram.`}
        >
          <KpiCard
            rotulo="Nascidos em atraso"
            icone={CalendarClock}
            valor={nascPct != null ? formatarPercentual(nascPct, { separador: "." }) : "—"}
            status="bom"
            neutro
            progresso={nascPct ?? undefined}
            detalhe={nascSub}
            aoClicar={nascPct != null && nascQtd > 0 ? acoes.nascidos : undefined}
          />
        </ComDica>
        {configuracao.otifVisivel && (
          <ComDica dica="De cada 100 CTRCs do período, quantos tiveram algum problema no percurso — pendência do cliente ou da operação — mesmo que tenham sido entregues no fim. Quanto menor, melhor. Mesma leitura do OTIF do Romaneio, que usa só as cargas que já saíram para entrega.">
            <KpiCard
              rotulo="OTIF"
              icone={PackageSearch}
              valor={otifPct == null ? "—" : formatarPercentual(otifPct, { separador: "." })}
              status={statusDoOtif(otifPct)}
              neutro={otifPct == null}
              progresso={otifPct ?? undefined}
              selo={otifPct == null ? undefined : "menor é melhor"}
              detalhe={
                otifPct == null
                  ? "Sem CTRCs no período"
                  : `${formatarInteiro(otif?.problemas ?? 0)} de ${formatarInteiro(otif?.total ?? 0)} CTRCs tiveram algum problema no percurso — quanto menor, melhor`
              }
              aoClicar={otifPct != null && (otif?.problemas ?? 0) > 0 ? acoes.otif : undefined}
            />
          </ComDica>
        )}
        <ComDica dica="CTRCs com ocorrência 13 (Entrega prejudicada pelo horário) sobre os CT-e concluídos no período (entregues + finalizados sem entrega). CT-e em aberto não entram na conta.">
          <KpiCard
            rotulo="Taxa de retorno"
            icone={RotateCcw}
            valor={formatarPercentual(taxa, { separador: "." })}
            status={statusDoRetorno(taxa, metaTaxa)}
            neutro={metaTaxa == null}
            selo={acimaDaMeta ? "acima" : metaTaxa != null ? "ok" : undefined}
            detalhe={`${metaTaxa != null ? `meta ≤ ${formatarPercentual(metaTaxa, { separador: "." })}` : "sem meta definida"} · base: ${formatarInteiro(r.ctrcsConcluidos)} CT-e concluídos`}
          />
        </ComDica>
        <ComDica dica={DICA_DO_ATRASO(nomeCurto)}>
          <KpiCard
            rotulo="Em Atraso"
            icone={AlarmClock}
            valor={formatarInteiro(r.ctrcsEmAtraso)}
            status="alerta"
            neutro={r.ocorrenciasPendentes === 0}
            selo={
              r.ocorrenciasPendentes > 0
                ? `+${String(r.ocorrenciasPendentes)} pendentes`
                : undefined
            }
            detalhe={`CT-e em aberto com prazo vencido · de ${formatarInteiro(r.ctrcsEmAberto)} em aberto${r.ctrcsSemPrazo > 0 ? ` · ${formatarInteiro(r.ctrcsSemPrazo)} sem prazo definido` : ""}`}
            aoClicar={temAtraso ? acoes.emAtraso : undefined}
          />
        </ComDica>
      </div>

      {(mostrarDistribuicao || temAtraso) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {mostrarDistribuicao && (
            <Painel
              rotulo="SLA Operacional"
              titulo="Como estão os CTRCs em relação ao prazo"
              className={temAtraso ? "lg:col-span-2" : "lg:col-span-3"}
              classeDoCorpo="p-4"
            >
              <DistribuicaoPontualidade
                noPrazo={t.noPrazo}
                foraPrazo={t.foraPrazo}
                excluidoCliente={t.excluidoCliente}
                semInfo={t.semInfoBi2}
                nomeCurto={nomeCurto}
              />
            </Painel>
          )}
          {temAtraso && (
            <Painel
              rotulo="Em Atraso"
              titulo="Por responsabilidade"
              className={mostrarDistribuicao ? undefined : "lg:col-span-3"}
              classeDoCorpo="grid grid-cols-2 gap-3 p-4"
            >
              <SubAtraso
                rotulo={nomeCurto}
                valor={r.ctrcsEmAtrasoFr}
                destaque
                onClick={acoes.emAtrasoFr}
                titulo={`Em atraso de responsabilidade da ${nomeCurto} — reflete a operação.`}
              />
              <SubAtraso
                rotulo="Aguardando cliente/parceiro"
                valor={r.ctrcsEmAtrasoCliente}
                onClick={acoes.emAtrasoCliente}
                titulo={`Em atraso aguardando ação do cliente/parceiro — rastreado, não é falha da ${nomeCurto}.`}
              />
            </Painel>
          )}
        </div>
      )}
    </>
  );
}

function SubAtraso({
  rotulo,
  valor,
  destaque,
  onClick,
  titulo,
}: {
  rotulo: string;
  valor: number;
  destaque?: boolean;
  onClick: () => void;
  titulo: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      className={cn(
        "group flex min-w-0 flex-col rounded-xl border px-4 py-3 text-left transition-[box-shadow,border-color] hover:border-brand/40 hover:shadow-cartao focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        destaque ? "border-status-warn/40 bg-status-warn-bg" : "border-border bg-card",
      )}
    >
      <span className="label-xs line-clamp-2">{rotulo}</span>
      <span className="mt-auto flex items-center justify-between gap-2 pt-2">
        <span
          className={cn(
            "text-[22px] font-bold tabular-nums",
            destaque ? "text-status-warn-fg" : "text-foreground",
          )}
        >
          {formatarInteiro(valor)}
        </span>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </button>
  );
}
