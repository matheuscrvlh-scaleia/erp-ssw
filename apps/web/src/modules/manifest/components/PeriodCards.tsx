import { type Recorte, type TotaisDoTopo } from "@erp/shared/contracts/manifest";
import {
  formatarInteiro,
  formatarMoeda,
  formatarPercentual,
  formatarPeso,
} from "@erp/shared/formatting";
import {
  Banknote,
  CirclePause,
  FileText,
  Package,
  PackageCheck,
  PackageX,
  Receipt,
  TrendingDown,
  TriangleAlert,
  Truck,
  Warehouse,
  Weight,
} from "lucide-react";

import { KpiCard } from "@/components/common/KpiCard";
import { Painel } from "@/components/common/Panel";

import { type ChaveDaFaixa, FaixasDePrazo } from "./DeadlineRanges";
import { GradeDeIndicadores } from "./IndicatorsGrid";
import { AlternarCardsSecundarios } from "./ToggleSecondaryCards";

export interface PropsCardsDoPeriodo {
  totais: TotaisDoTopo | undefined;
  otifVisivel: boolean;
  verTodos: boolean;
  cardsSecundarios: { ocultos: boolean; alternar: () => void };
  aoAbrir: (recorte: Recorte) => void;
}

const RECORTE_DA_FAIXA: Record<ChaveDaFaixa, Recorte> = {
  vencida: "em_rota_vencida",
  hoje: "em_rota_hoje",
  futuro: "em_rota_futuro",
  sem_prev: "em_rota_sem_prev",
};

/** Linha de apoio do card: as partes que existem, separadas por " · ". */
const juntar = (...partes: (string | undefined)[]) =>
  partes.filter((p): p is string => Boolean(p)).join(" · ");

/**
 * Totalizadores do período: ficam no topo em todas as abas menos Performance por romaneio, onde
 * aparecem lá dentro (mesmos números, mesmos filtros). Partição: entregues + em rota + baixado +
 * travado + parado = total.
 */
export function CardsDoPeriodo({
  totais: t,
  otifVisivel,
  verTodos,
  cardsSecundarios,
  aoAbrir,
}: PropsCardsDoPeriodo) {
  const base = t?.ctes ?? 0;
  const pctBase = (n: number) =>
    base > 0 ? `${formatarPercentual(n / base)} do total do período` : undefined;
  const otifPct = t && base > 0 ? (t.otifProblemas / base) * 100 : null;
  const n = (v: number | undefined) => formatarInteiro(v ?? 0);
  const abrir = (recorte: Recorte) => () => {
    aoAbrir(recorte);
  };
  return (
    <div className="space-y-4">
      <GradeDeIndicadores>
        <KpiCard
          rotulo="CTRC"
          icone={FileText}
          neutro
          status="bom"
          valor={n(t?.ctes)}
          detalhe="Total do período"
          dica="Todos os CTRCs do período e dos filtros escolhidos, sem os que foram cancelados no mesmo dia da emissão. É a base dos percentuais desta tela."
          aoClicar={abrir("todos")}
        />
        <KpiCard
          rotulo="Peso total"
          icone={Weight}
          neutro
          status="bom"
          valor={formatarPeso(t?.peso ?? 0, { fixas: true })}
          detalhe=""
          dica="Peso somado das mercadorias do período. Acima de 1.000 kg aparece em toneladas."
        />
        <KpiCard
          rotulo="Volumes"
          icone={Package}
          neutro
          status="bom"
          valor={n(t?.volumes)}
          detalhe=""
          dica="Quantidade de volumes somada de todas as cargas do período."
        />
        <KpiCard
          rotulo="Frete total"
          icone={Banknote}
          neutro
          status="bom"
          valor={formatarMoeda(t?.frete ?? 0)}
          detalhe=""
          dica="Valor de frete somado de todas as cargas do período."
        />
      </GradeDeIndicadores>
      <GradeDeIndicadores max={5}>
        <KpiCard
          rotulo="Em rota de entrega"
          icone={Truck}
          neutro
          status="alerta"
          valor={n(t?.emRota)}
          detalhe={juntar(pctBase(t?.emRota ?? 0), "Saiu para entrega e ainda não foi entregue.")}
          dica="Mesma regra da aba Hoje: cargas que saíram para entrega e ainda não foram entregues. Inclui quem recebeu ocorrência depois da saída (ausente, recusa, pendência…), que também aparece em Travado em ocorrência, e quem foi baixado sem entrega. Vendo por Saída para entrega, é o total de CT-e menos os entregues."
          aoClicar={abrir("em_rota")}
        />
        <KpiCard
          rotulo="Entregues"
          icone={PackageCheck}
          neutro
          status="bom"
          valor={n(t?.entregues)}
          detalhe={pctBase(t?.entregues ?? 0) ?? "sem base no período"}
          dica="Cargas com entrega confirmada ao destinatário. Conta todo o período; nas abas de Performance o mesmo indicador considera só as cargas que já saíram para entrega, por isso os números podem diferir levemente."
          aoClicar={abrir("entregues")}
        />
        {!cardsSecundarios.ocultos && (
          <KpiCard
            rotulo="Baixado sem entrega"
            icone={PackageX}
            neutro
            status="alerta"
            valor={n(t?.baixadoSemEntrega)}
            detalhe={pctBase(t?.baixadoSemEntrega ?? 0) ?? ""}
            dica="Cargas encerradas por baixa formal, sem entrega: devolução ao parceiro, coleta cancelada, mercadoria indenizada, confiscada ou liberada pelo seguro, CTRC substituído, cancelado ou emitido só para efeito de frete. NÃO é a mesma coisa que a Taxa de retorno das abas de Performance, que conta cargas que voltaram com o código 13 — por isso os dois números são diferentes."
            aoClicar={abrir("devolvido")}
          />
        )}
        <KpiCard
          rotulo="Travado em ocorrência"
          icone={CirclePause}
          neutro
          status="alerta"
          valor={n(t?.travado)}
          detalhe={
            t?.travadoMotivo
              ? `Principal: ${t.travadoMotivo.toLowerCase()}`
              : (pctBase(t?.travado ?? 0) ?? "")
          }
          dica={`Cargas com pendência do cliente ou da operação que ainda não saíram de novo para entrega. Só uma nova saída para entrega tira a carga daqui; agendamento, chegada na unidade ou "pendência solucionada" não bastam.${t?.travadoMotivo ? ` Motivo mais frequente: ${t.travadoMotivo.toLowerCase()}.` : ""}`}
          aoClicar={abrir("travado")}
        />
        {verTodos && !cardsSecundarios.ocultos && (
          <KpiCard
            rotulo="Parado sem saída"
            icone={Warehouse}
            neutro
            status="alerta"
            valor={n(t?.parado)}
            detalhe={pctBase(t?.parado ?? 0) ?? ""}
            dica="Cargas que ainda não saíram para entrega e nunca tiveram pendência, incluindo as recém-criadas sem nenhuma movimentação registrada: seguem na unidade aguardando programação. Carga com pendência fica em Travado em ocorrência."
            aoClicar={abrir("parado")}
          />
        )}
      </GradeDeIndicadores>
      <GradeDeIndicadores>
        <KpiCard
          rotulo="TDE romaneado"
          icone={Receipt}
          neutro
          status="bom"
          valor={n(t?.tdeRomaneado)}
          detalhe={`${n(t?.tdeRomaneadoEmRota)} em rota · ${n(t?.tdeRomaneadoEntregue)} entregues · ${formatarMoeda(t?.tdeRomaneadoValor ?? 0)} de TDE · ${n(t?.tdeCtes)} CTRC com TDE no período`}
          dica="Cargas com TDE (taxa de dificuldade de entrega, do relatório 455) que já saíram para entrega: em rota ou entregues. As que ainda aguardam programação estão no card “TDE aguardando programação” da tela Performance."
          aoClicar={abrir("tde_romaneado")}
        />
        {otifVisivel && (
          <KpiCard
            rotulo="CTRC com problema (OTIF)"
            icone={TriangleAlert}
            neutro
            status="alerta"
            valor={otifPct == null ? "—" : formatarPercentual(otifPct, { escala: "cem" })}
            detalhe={`${n(t?.otifProblemas)} CTRC`}
            dica="De cada 100 cargas do período, quantas tiveram algum problema no percurso — pendência do cliente ou da operação — mesmo que tenham sido entregues no prazo. Quanto menor, melhor."
            aoClicar={abrir("otif")}
          />
        )}
        <KpiCard
          rotulo="Prejuízo"
          icone={TrendingDown}
          neutro
          status="ruim"
          valor={formatarMoeda(t?.prejuizoFrete ?? 0)}
          detalhe={`${n(t?.prejuizoCtes)} CTRC`}
          dica="Frete das cargas com problema de responsabilidade da transportadora no período."
          aoClicar={abrir("prejuizo")}
        />
      </GradeDeIndicadores>
      <div className="flex justify-end">
        <AlternarCardsSecundarios
          ocultos={cardsSecundarios.ocultos}
          quantos={verTodos ? 2 : 1}
          aoClicar={cardsSecundarios.alternar}
        />
      </div>
      <Painel classeDoCorpo="px-5 py-4">
        <FaixasDePrazo
          rotulo={`Em rota, por prazo${!verTodos ? " (somente romaneados)" : ""}`}
          faixas={
            t && {
              vencida: t.emRotaVencida,
              hoje: t.emRotaHoje,
              futuro: t.emRotaFuturo,
              semPrev: t.emRotaSemPrev,
            }
          }
          aoAbrir={(faixa) => {
            aoAbrir(RECORTE_DA_FAIXA[faixa]);
          }}
        />
      </Painel>
    </div>
  );
}
