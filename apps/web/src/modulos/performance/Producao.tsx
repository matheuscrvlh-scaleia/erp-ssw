import { verificarParticao } from "@erp/dominio/performance/tela";
import { type BlocoProducao, type TdeAguardando } from "@erp/shared/contratos/performance";
import { formatarInteiro, formatarMoeda, formatarPercentual } from "@erp/shared/formatacao";
import {
  AlertTriangle,
  Archive,
  CalendarCheck,
  CalendarX,
  CircleCheck,
  FileText,
  Hourglass,
  type LucideIcon,
  Percent,
  Truck,
} from "lucide-react";

import { KpiCard, type StatusKpi } from "@/componentes/comum/KpiCard";
import { cn } from "@/lib/utils";

import { ComDica } from "./Kpis";

export type CardDeProducao =
  | "emitidos"
  | "entregues"
  | "no_prazo"
  | "fora_prazo"
  | "finalizado_sistema"
  | "producao_pct"
  | "tde";

interface Cartao {
  card: CardDeProducao;
  rotulo: string;
  icone: LucideIcon;
  valor: string;
  /** Explicação curta que ficava sob o rótulo; vai no rodapé, antes do apoio. */
  legenda?: string | undefined;
  sub: string;
  /** Sem situação: cartão neutro (sem selo). */
  status?: StatusKpi | undefined;
  progresso?: number | undefined;
  dica?: string | undefined;
  classe?: string | undefined;
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
  const cartoes: Cartao[] = [
    {
      card: "emitidos",
      rotulo: "CT-e Emitidos",
      icone: FileText,
      valor: formatarInteiro(bloco.totalCtrcs),
      sub: "total no período",
    },
    {
      card: "entregues",
      rotulo: "Entregues",
      icone: CircleCheck,
      valor: formatarInteiro(bloco.entregues),
      sub:
        bloco.totalCtrcs > 0
          ? `${formatarPercentual(producaoPct, { escala: "cem" })} dos emitidos`
          : "sem emissões",
    },
    {
      card: "no_prazo",
      rotulo: "No Prazo",
      icone: CalendarCheck,
      valor: formatarInteiro(bloco.noPrazo),
      legenda: "Entregues até a data combinada",
      sub:
        noPrazoPct != null
          ? `${formatarPercentual(noPrazoPct, { escala: "cem" })} dos entregues`
          : "aguardando entregas",
      status: noPrazoPct != null && noPrazoPct >= slaMetaPct ? "bom" : undefined,
      dica: "Entregas que chegaram até a data combinada.",
    },
    {
      card: "fora_prazo",
      rotulo: "Fora do Prazo",
      icone: CalendarX,
      valor: formatarInteiro(bloco.foraPrazo),
      legenda: "Entregues depois da data combinada",
      sub: "exclui resp. cliente",
      status: bloco.foraPrazo > 0 ? "alerta" : undefined,
      dica: "Entregas que chegaram depois da data combinada. Já exclui os atrasos de responsabilidade do cliente/parceiro.",
    },
    {
      card: "finalizado_sistema",
      rotulo: "Finalizado em Sistema",
      icone: Archive,
      valor: formatarInteiro(bloco.finalizadoSistema),
      sub:
        bloco.totalCtrcs > 0
          ? `${formatarPercentual((bloco.finalizadoSistema / bloco.totalCtrcs) * 100, { escala: "cem" })} dos emitidos`
          : "sem emissões",
      dica: "CTRCs que tiveram baixa no sistema sem entrega ao destinatário — devolução, indenização, cancelamento ou substituição.",
    },
    {
      card: "producao_pct",
      rotulo: "% Produção",
      icone: Percent,
      valor: formatarPercentual(producaoPct, { escala: "cem" }),
      sub: `entregues / emitidos · meta ${formatarPercentual(slaMetaPct, { escala: "cem" })}`,
      status: producaoPct != null && producaoPct >= slaMetaPct ? "bom" : undefined,
      progresso: producaoPct != null ? producaoPct / 100 : undefined,
    },
    {
      card: "tde",
      rotulo: "TDE aguardando programação",
      icone: tde && tde.aguardando > 0 ? Hourglass : Truck,
      valor: tde ? formatarInteiro(tde.aguardando) : "…",
      legenda: "Com TDE e ainda sem saída para entrega",
      sub: tde
        ? `${formatarMoeda(tde.valor, { centavos: false })} de TDE · ${formatarInteiro(tde.total)} CT-e com TDE no período`
        : "carregando",
      status: tde && tde.aguardando > 0 ? "alerta" : undefined,
      dica: "Cargas com TDE (taxa de dificuldade de entrega, do relatório 455) que ainda não saíram para entrega: travadas em ocorrência ou paradas na unidade. A lista mostra cliente, destino, prazo e última ocorrência para montar a programação. As que já saíram estão no card “TDE romaneado” da tela Romaneio.",
      classe: "sm:col-span-2",
    },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cartoes.map((c) => {
        const cartao = (
          <KpiCard
            rotulo={c.rotulo}
            icone={c.icone}
            valor={c.valor}
            status={c.status ?? "bom"}
            neutro={c.status === undefined}
            progresso={c.progresso}
            detalhe={c.legenda ? `${c.legenda} · ${c.sub}` : c.sub}
            aoClicar={() => {
              onCard(c.card);
            }}
          />
        );
        return (
          <div key={c.card} className={cn("flex min-w-0", c.classe)}>
            {c.dica ? <ComDica dica={c.dica}>{cartao}</ComDica> : cartao}
          </div>
        );
      })}
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
    <p
      className={cn(
        "flex items-start gap-2 text-[12.5px]",
        diferenca === 0 ? "text-muted-foreground" : "text-status-warn-fg",
      )}
    >
      {diferenca === 0 ? (
        <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-status-good" aria-hidden />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      )}
      <span>
        <strong className="font-semibold text-foreground">Verificação:</strong> Entregues (
        {formatarInteiro(bloco.entregues)}) + Finalizado em Sistema (
        {formatarInteiro(bloco.finalizadoSistema)}) + Previstos no período (
        {formatarInteiro(bloco.previstos)}) ={" "}
        <strong className="font-semibold text-foreground">{formatarInteiro(soma)}</strong> de{" "}
        {formatarInteiro(bloco.totalCtrcs)} CT-e emitidos{" "}
        {diferenca === 0
          ? "— partição fecha 100%."
          : `— diferença de ${formatarInteiro(Math.abs(diferenca))} CTRC.`}
        {ignorarPeriodo && (
          <>
            {" "}
            O bloco Previstos acima está em{" "}
            <strong className="font-semibold">&quot;Todos em aberto&quot;</strong> e mostra um
            número maior; esta verificação usa sempre os previstos emitidos no período.
          </>
        )}
      </span>
    </p>
  );
}
