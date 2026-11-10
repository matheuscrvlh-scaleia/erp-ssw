import {
  type Status,
  statusDoOtif,
  statusDoRetorno,
  statusDoSla,
} from "@erp/dominio/performance/tela";
import {
  type ConfiguracaoPerformance,
  type Otif,
  type Pontualidade,
  type ResumoPerformance,
} from "@erp/shared/contratos/performance";
import { formatarInteiro, formatarPercentual } from "@erp/shared/formatacao";
import { type KeyboardEvent, type ReactNode } from "react";

import { Skeleton } from "@/componentes/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/componentes/ui/tooltip";
import { cn } from "@/lib/utils";

import { corDoStatus, fundoDoStatus, textoDoStatus } from "./cores";

/** Props de um bloco clicável por mouse e teclado (Enter/Espaço). */
export function clicavel(acao: (() => void) | undefined, pararPropagacao = false) {
  if (!acao) return {};
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: (e: { stopPropagation: () => void }) => {
      if (pararPropagacao) e.stopPropagation();
      acao();
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      if (pararPropagacao) e.stopPropagation();
      acao();
    },
  };
}

function KpiBox({
  rotulo,
  valor,
  status,
  selo,
  statusDoSelo,
  progresso,
  sub,
  neutro,
  titulo,
  onClick,
}: {
  rotulo: string;
  valor: string;
  status: Status;
  selo?: string | undefined;
  statusDoSelo?: Status;
  progresso?: number | null;
  sub: ReactNode;
  neutro?: boolean;
  titulo?: string;
  onClick?: (() => void) | undefined;
}) {
  const s = statusDoSelo ?? status;
  const destaque = neutro
    ? "border-l-kpi-volume text-kpi-volume"
    : status === "bom"
      ? "border-l-kpi-positive text-kpi-positive"
      : status === "alerta"
        ? "border-l-kpi-alert text-kpi-alert"
        : "border-l-kpi-volume text-kpi-volume";
  return (
    <div
      className={
        "rounded-[10px] border border-border/70 border-l-[5px] bg-card p-5 " +
        destaque +
        (onClick ? " cursor-pointer transition-colors hover:border-border hover:bg-muted/30" : "")
      }
      title={titulo}
      {...clicavel(onClick)}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="label-xs flex items-center gap-1.5 font-bold text-foreground">
          {rotulo}
        </span>
        {selo && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
            style={{ background: fundoDoStatus[s], color: textoDoStatus[s] }}
          >
            {selo}
          </span>
        )}
      </div>
      <div className="num-hero mt-3 font-bold tracking-normal">{valor}</div>
      {progresso != null && (
        <div className="mt-3 h-[5px] overflow-hidden rounded-full bg-border/60">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.max(2, Math.min(100, progresso * 100))}%`,
              backgroundColor: corDoStatus[status],
            }}
          />
        </div>
      )}
      <div className="mt-2 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

const pct1 = (v: number) => formatarPercentual(v, { escala: "cem" });

/** Distribuição da pontualidade (barra empilhada + linhas). origem: PontualidadeBreakdown.tsx */
export function DistribuicaoPontualidade({
  noPrazo,
  foraPrazo,
  excluidoCliente,
  semInfo,
  nomeCurto,
}: {
  noPrazo: number;
  foraPrazo: number;
  excluidoCliente: number;
  semInfo: number;
  nomeCurto: string;
}) {
  const total = noPrazo + foraPrazo + excluidoCliente + semInfo;
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  const segmentos = [
    {
      chave: "no_prazo",
      rotulo: "No prazo",
      valor: noPrazo,
      cor: corDoStatus.bom,
      dica: "Entregas que chegaram até a data combinada.",
    },
    {
      chave: "fora_prazo",
      rotulo: "Fora do prazo",
      valor: foraPrazo,
      cor: corDoStatus.ruim,
      dica: "Entregas que chegaram depois da data combinada.",
    },
    {
      chave: "excluido",
      rotulo: "Excluído (resp. cliente/parceiro)",
      valor: excluidoCliente,
      cor: corDoStatus.alerta,
      dica: `Atraso que não é culpa da ${nomeCurto} — o cliente ou parceiro causou o atraso, então não conta contra nós.`,
    },
    {
      chave: "sem_info",
      rotulo: "Ainda sem confirmação do SSW",
      valor: semInfo,
      cor: "var(--muted-foreground)",
      dica: "CTRCs que ainda não foram entregues, ou cuja entrega ainda não foi confirmada pelo sistema do SSW. A maioria são os 'Previstos' — ainda a caminho.",
    },
  ];
  const conteudo = (s: (typeof segmentos)[number]) => (
    <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
      <div className="font-medium">{s.rotulo}</div>
      <div className="mt-0.5 font-medium tabular-nums">
        {formatarInteiro(s.valor)} CTRCs{total > 0 ? ` · ${pct1(pct(s.valor))}` : ""}
      </div>
      <div className="mt-1 font-normal">{s.dica}</div>
    </TooltipContent>
  );
  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-2">
        {total > 0 && (
          <div
            className="flex h-1.5 w-full overflow-hidden rounded-full bg-border/60"
            role="img"
            aria-label="Distribuição de pontualidade"
          >
            {segmentos
              .filter((s) => s.valor > 0)
              .map((s) => (
                <Tooltip key={s.chave}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`${s.rotulo}: ${formatarInteiro(s.valor)} (${pct1(pct(s.valor))})`}
                      className="h-full transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand)]"
                      style={{ width: `${Math.max(1.5, pct(s.valor))}%`, backgroundColor: s.cor }}
                    />
                  </TooltipTrigger>
                  {conteudo(s)}
                </Tooltip>
              ))}
          </div>
        )}
        <div className="flex flex-col gap-1">
          {segmentos.map((s) => (
            <Tooltip key={s.chave}>
              <TooltipTrigger asChild>
                <div
                  tabIndex={0}
                  className="flex min-w-0 items-center gap-2 rounded-md border border-border/40 bg-card/50 px-2 py-1 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand)]"
                >
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.cor }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                    {s.rotulo}
                  </span>
                  <span className="shrink-0 text-[11px] font-medium tabular-nums text-foreground">
                    {formatarInteiro(s.valor)}
                  </span>
                  {total > 0 && (
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {pct1(pct(s.valor))}
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              {conteudo(s)}
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

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
  const metaTaxa = resumo.metaTaxaRetorno;
  const taxa = resumo.totais.taxaRetorno;
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
  const otifStatus = statusDoOtif(otifPct);

  return (
    <div
      className={
        "grid grid-cols-1 gap-3 sm:grid-cols-2 " +
        (configuracao.otifVisivel ? "lg:grid-cols-5" : "lg:grid-cols-4")
      }
    >
      <KpiBox
        rotulo="SLA Operacional"
        titulo="CT-e emitidos menos os entregues fora do prazo, sobre os CT-e emitidos. Fora do prazo exclui responsabilidade do cliente."
        valor={slaOp != null ? formatarPercentual(slaOp, { separador: "." }) : "—"}
        status={slaOp != null ? statusDoSla(slaOp, meta, alerta) : "bom"}
        neutro={slaOp == null}
        progresso={slaOp}
        sub={
          slaOp != null && t ? (
            <DistribuicaoPontualidade
              noPrazo={t.noPrazo}
              foraPrazo={t.foraPrazo}
              excluidoCliente={t.excluidoCliente}
              semInfo={t.semInfoBi2}
              nomeCurto={nomeCurto}
            />
          ) : (
            semSlaOperacional(t)
          )
        }
      />
      <KpiBox
        rotulo="Nascidos em atraso"
        titulo={`CTRCs emitidos a menos de 48 horas da previsão de entrega (horas corridas: fim de semana e feriado contam). Ex.: emitido na terça com previsão para quarta. Nesses casos a ${nomeCurto} não tinha como cumprir: o atraso é do parceiro. CTRCs da TROCA ficam fora da conta. Só compara prazos — ocorrências, inclusive as de responsabilidade do cliente, não entram.`}
        valor={nascPct != null ? formatarPercentual(nascPct, { separador: "." }) : "—"}
        status="bom"
        neutro
        progresso={nascPct}
        sub={nascSub}
        onClick={nascPct != null && nascQtd > 0 ? acoes.nascidos : undefined}
      />
      {configuracao.otifVisivel && (
        <KpiBox
          rotulo="OTIF"
          titulo="De cada 100 CTRCs do período, quantos tiveram algum problema no percurso — pendência do cliente ou da operação — mesmo que tenham sido entregues no fim. Quanto menor, melhor. Mesma leitura do OTIF do Romaneio, que usa só as cargas que já saíram para entrega."
          valor={otifPct == null ? "—" : formatarPercentual(otifPct, { separador: "." })}
          status={otifStatus}
          neutro={otifPct == null}
          progresso={otifPct}
          selo={otifPct == null ? undefined : "menor é melhor"}
          statusDoSelo={otifStatus}
          sub={
            otifPct == null
              ? "Sem CTRCs no período"
              : `${formatarInteiro(otif?.problemas ?? 0)} de ${formatarInteiro(otif?.total ?? 0)} CTRCs tiveram algum problema no percurso — quanto menor, melhor`
          }
          onClick={otifPct != null && (otif?.problemas ?? 0) > 0 ? acoes.otif : undefined}
        />
      )}
      <KpiBox
        rotulo="Taxa de retorno"
        valor={formatarPercentual(taxa, { separador: "." })}
        status={statusDoRetorno(taxa, metaTaxa)}
        selo={acimaDaMeta ? "acima" : metaTaxa != null ? "ok" : undefined}
        statusDoSelo={acimaDaMeta ? "ruim" : "bom"}
        sub={`${metaTaxa != null ? `meta ≤ ${formatarPercentual(metaTaxa, { separador: "." })}` : "sem meta definida"} · base: ${formatarInteiro(resumo.totais.ctrcsConcluidos)} CT-e concluídos`}
        titulo="CTRCs com ocorrência 13 (Entrega prejudicada pelo horário) sobre os CT-e concluídos no período (entregues + finalizados sem entrega). CT-e em aberto não entram na conta."
      />
      <CaixaEmAtraso resumo={resumo} nomeCurto={nomeCurto} acoes={acoes} />
    </div>
  );
}

function CaixaEmAtraso({
  resumo,
  nomeCurto,
  acoes,
}: {
  resumo: ResumoPerformance;
  nomeCurto: string;
  acoes: AcoesDosKpis;
}) {
  const t = resumo.totais;
  const temAtraso = t.ctrcsEmAtraso > 0;
  return (
    <div
      className={
        "rounded-[10px] border border-border/70 border-l-[5px] border-l-kpi-alert bg-card p-5" +
        (temAtraso
          ? " cursor-pointer transition-colors hover:border-[var(--brand)]/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand)]"
          : "")
      }
      title={
        "CT-e cuja última ocorrência efetiva não é finalizadora (fora dos códigos de baixa) e cujo prazo de entrega vigente já venceu. " +
        "Considera o prazo atualizado no SSW, não o original. O total conta todos (rastreio geral); logo abaixo é separado por responsabilidade: " +
        `os que aguardam cliente/parceiro continuam sendo rastreados, mas não refletem falha operacional da ${nomeCurto}. CT-e sem prazo definido não é avaliado.`
      }
      {...clicavel(temAtraso ? acoes.emAtraso : undefined)}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="label-xs font-bold text-foreground">Em Atraso</span>
        {t.ocorrenciasPendentes > 0 && (
          <a
            href="/admin/codigos"
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
            style={{ background: fundoDoStatus.alerta, color: textoDoStatus.alerta }}
          >
            +{t.ocorrenciasPendentes} pendentes
          </a>
        )}
      </div>
      <div className="num-hero mt-3 font-bold tracking-normal text-kpi-alert">
        {formatarInteiro(t.ctrcsEmAtraso)}
      </div>
      {temAtraso && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <SubAtraso
            rotulo={nomeCurto}
            valor={t.ctrcsEmAtrasoFr}
            destaque
            onClick={acoes.emAtrasoFr}
            titulo={`Em atraso de responsabilidade da ${nomeCurto} — reflete a operação.`}
          />
          <SubAtraso
            rotulo="Aguardando cliente/parceiro"
            valor={t.ctrcsEmAtrasoCliente}
            onClick={acoes.emAtrasoCliente}
            titulo={`Em atraso aguardando ação do cliente/parceiro — rastreado, não é falha da ${nomeCurto}.`}
          />
        </div>
      )}
      <div className="mt-2 text-[11px] text-muted-foreground">
        CT-e em aberto com prazo vencido · de {formatarInteiro(t.ctrcsEmAberto)} em aberto
        {t.ctrcsSemPrazo > 0 ? ` · ${formatarInteiro(t.ctrcsSemPrazo)} sem prazo definido` : ""}
      </div>
    </div>
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
    <div
      className={
        "cursor-pointer rounded-md border px-2 py-1.5 transition-colors hover:bg-muted/60 " +
        (destaque ? "border-kpi-alert/40 bg-kpi-alert/5" : "border-border/60 bg-muted/30")
      }
      title={titulo}
      {...clicavel(onClick, true)}
    >
      <div className="text-[9px] uppercase leading-tight tracking-wide text-muted-foreground">
        {rotulo}
      </div>
      <div
        className={
          "mt-0.5 text-[18px] font-semibold tabular-nums " +
          (destaque ? "text-kpi-alert" : "text-foreground")
        }
      >
        {formatarInteiro(valor)}
      </div>
    </div>
  );
}

export function EsqueletoDeCards({ quantos, altura }: { quantos: number; altura: string }) {
  return (
    <div
      className={
        "grid grid-cols-1 gap-3 sm:grid-cols-2 " +
        (quantos === 7 ? "lg:grid-cols-4 xl:grid-cols-7" : "lg:grid-cols-5")
      }
    >
      {Array.from({ length: quantos }, (_, i) => (
        <Skeleton
          key={i}
          className={cn(altura, "rounded-[10px] border border-border/70 bg-muted/40")}
        />
      ))}
    </div>
  );
}
