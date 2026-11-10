import { verificarParticao } from "@erp/dominio/performance/tela";
import { type BlocoProducao, type TdeAguardando } from "@erp/shared/contratos/performance";
import { ArrowRight } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/componentes/ui/tooltip";

import { fmtBRL, fmtInt, fmtPct100 } from "../formato";

export type CardDeProducao =
  | "emitidos"
  | "entregues"
  | "no_prazo"
  | "fora_prazo"
  | "finalizado_sistema"
  | "producao_pct"
  | "tde";

type Tom = "bom" | "ruim" | "neutro" | "info";

function CartaoDeProducao({
  rotulo,
  valor,
  sub,
  legenda,
  tom = "neutro",
  dica,
  onClick,
}: {
  rotulo: string;
  valor: string;
  sub: string;
  legenda?: string;
  tom?: Tom;
  dica?: string;
  onClick: () => void;
}) {
  const destaque =
    tom === "bom" || tom === "info"
      ? "border-l-kpi-positive text-kpi-positive"
      : tom === "ruim"
        ? "border-l-kpi-alert text-kpi-alert"
        : "border-l-kpi-volume text-kpi-volume";
  const botao = (
    <button
      type="button"
      onClick={onClick}
      className={`group flex h-full cursor-pointer flex-col rounded-[10px] border border-border/70 border-l-[5px] bg-card p-5 text-left transition-colors hover:border-border hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${destaque}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="label-xs font-bold text-foreground">{rotulo}</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--brand)]" />
      </div>
      <div className="mt-0.5 min-h-[26px] text-[10px] leading-tight text-muted-foreground">
        {legenda ?? ""}
      </div>
      <div className="flex flex-1 items-center justify-center py-2">
        <div
          className="text-center font-bold whitespace-nowrap tabular-nums"
          style={{ fontSize: "clamp(1.25rem, 2.4vw, 1.875rem)" }}
        >
          {valor}
        </div>
      </div>
      <div className="mt-auto min-h-[32px] text-[11px] leading-tight text-muted-foreground">
        {sub}
      </div>
    </button>
  );
  if (!dica) return botao;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{botao}</TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">{dica}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Linha de produção (mesmo bloco do Relatório de período) + card TDE. */
export function LinhaDeProducao({
  bloco,
  tde,
  slaMetaPct,
  onCard,
}: {
  bloco: BlocoProducao;
  tde: TdeAguardando | undefined;
  slaMetaPct: number;
  onCard: (card: CardDeProducao) => void;
}) {
  const producaoPct = bloco.totalCtrcs > 0 ? (bloco.entregues / bloco.totalCtrcs) * 100 : null;
  const noPrazoPct = bloco.entregues > 0 ? (bloco.noPrazo / bloco.entregues) * 100 : null;
  return (
    <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      <CartaoDeProducao
        rotulo="CT-e Emitidos"
        valor={fmtInt(bloco.totalCtrcs)}
        sub="total no período"
        onClick={() => {
          onCard("emitidos");
        }}
      />
      <CartaoDeProducao
        rotulo="Entregues"
        valor={fmtInt(bloco.entregues)}
        sub={bloco.totalCtrcs > 0 ? `${fmtPct100(producaoPct)} dos emitidos` : "sem emissões"}
        onClick={() => {
          onCard("entregues");
        }}
      />
      <CartaoDeProducao
        rotulo="No Prazo"
        valor={fmtInt(bloco.noPrazo)}
        legenda="Entregues até a data combinada"
        sub={noPrazoPct != null ? `${fmtPct100(noPrazoPct)} dos entregues` : "aguardando entregas"}
        tom={noPrazoPct != null && noPrazoPct >= slaMetaPct ? "bom" : "neutro"}
        dica="Entregas que chegaram até a data combinada."
        onClick={() => {
          onCard("no_prazo");
        }}
      />
      <CartaoDeProducao
        rotulo="Fora do Prazo"
        valor={fmtInt(bloco.foraPrazo)}
        legenda="Entregues depois da data combinada"
        sub="exclui resp. cliente"
        tom={bloco.foraPrazo > 0 ? "ruim" : "neutro"}
        dica="Entregas que chegaram depois da data combinada. Já exclui os atrasos de responsabilidade do cliente/parceiro."
        onClick={() => {
          onCard("fora_prazo");
        }}
      />
      <CartaoDeProducao
        rotulo="Finalizado em Sistema"
        valor={fmtInt(bloco.finalizadoSistema)}
        sub={
          bloco.totalCtrcs > 0
            ? `${fmtPct100((bloco.finalizadoSistema / bloco.totalCtrcs) * 100)} dos emitidos`
            : "sem emissões"
        }
        tom="info"
        dica="CTRCs que tiveram baixa no sistema sem entrega ao destinatário — devolução, indenização, cancelamento ou substituição."
        onClick={() => {
          onCard("finalizado_sistema");
        }}
      />
      <CartaoDeProducao
        rotulo="% Produção"
        valor={fmtPct100(producaoPct)}
        sub={`entregues / emitidos · meta ${fmtPct100(slaMetaPct)}`}
        tom={producaoPct != null && producaoPct >= slaMetaPct ? "bom" : "neutro"}
        onClick={() => {
          onCard("producao_pct");
        }}
      />
      <CartaoDeProducao
        rotulo="TDE aguardando programação"
        valor={tde ? fmtInt(tde.aguardando) : "…"}
        legenda="Com TDE e ainda sem saída para entrega"
        sub={
          tde
            ? `${fmtBRL(tde.valor)} de TDE · ${fmtInt(tde.total)} CT-e com TDE no período`
            : "carregando"
        }
        tom={tde && tde.aguardando > 0 ? "ruim" : "neutro"}
        dica="Cargas com TDE (taxa de dificuldade de entrega, do relatório 455) que ainda não saíram para entrega: travadas em ocorrência ou paradas na unidade. A lista mostra cliente, destino, prazo e última ocorrência para montar a programação. As que já saíram estão no card “TDE romaneado” da tela Romaneio."
        onClick={() => {
          onCard("tde");
        }}
      />
    </div>
  );
}

/** Entregues + Finalizado em Sistema + Previstos = Emitidos. */
export function VerificacaoDaParticao({
  bloco,
  ignorarPeriodo,
}: {
  bloco: BlocoProducao;
  ignorarPeriodo: boolean;
}) {
  const { soma, diferenca } = verificarParticao(bloco);
  return (
    <div
      className={
        "rounded-[10px] border px-4 py-2.5 text-[11px] " +
        (diferenca === 0
          ? "border-border/70 bg-muted/30 text-muted-foreground"
          : "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400")
      }
    >
      <strong className="font-medium">Verificação:</strong> Entregues ({fmtInt(bloco.entregues)}) +
      Finalizado em Sistema ({fmtInt(bloco.finalizadoSistema)}) + Previstos no período (
      {fmtInt(bloco.previstos)}) = <strong className="font-medium">{fmtInt(soma)}</strong> de{" "}
      {fmtInt(bloco.totalCtrcs)} CT-e emitidos{" "}
      {diferenca === 0
        ? "— partição fecha 100%."
        : `— diferença de ${fmtInt(Math.abs(diferenca))} CTRC.`}
      {ignorarPeriodo && (
        <>
          {" "}
          O bloco Previstos acima está em{" "}
          <strong className="font-medium">&quot;Todos em aberto&quot;</strong> e mostra um número
          maior; esta verificação usa sempre os previstos emitidos no período.
        </>
      )}
    </div>
  );
}
