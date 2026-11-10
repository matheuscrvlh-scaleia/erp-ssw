import { type Recorte, type TotaisDoTopo } from "@erp/shared/contratos/romaneio";
import { formatarPercentual } from "@erp/shared/formatacao";

import { AlternarCardsSecundarios, FaixaChip, GradeCards, TotCard } from "./componentes";
import { fmtMoeda, fmtPeso, nfInt } from "./formatos";

export interface PropsCardsDoPeriodo {
  totais: TotaisDoTopo | undefined;
  otifVisivel: boolean;
  verTodos: boolean;
  cardsSecundarios: { ocultos: boolean; alternar: () => void };
  aoAbrir: (recorte: Recorte) => void;
}

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
  const n = (v: number | undefined) => nfInt.format(v ?? 0);
  return (
    <div className="space-y-1">
      <GradeCards>
        <TotCard
          rotulo="CTRC"
          valor={n(t?.ctes)}
          base="Total do período"
          dica="Todos os CTRCs do período e dos filtros escolhidos, sem os que foram cancelados no mesmo dia da emissão. É a base dos percentuais desta tela."
          aoClicar={() => {
            aoAbrir("todos");
          }}
        />
        <TotCard
          rotulo="Peso total"
          valor={fmtPeso(t?.peso ?? 0)}
          dica="Peso somado das mercadorias do período. Acima de 1.000 kg aparece em toneladas."
        />
        <TotCard
          rotulo="Volumes"
          valor={n(t?.volumes)}
          dica="Quantidade de volumes somada de todas as cargas do período."
        />
        <TotCard
          rotulo="Frete total"
          valor={fmtMoeda(t?.frete ?? 0)}
          dica="Valor de frete somado de todas as cargas do período."
        />
        <TotCard
          rotulo="Em rota de entrega"
          tom="alert"
          valor={n(t?.emRota)}
          base={pctBase(t?.emRota ?? 0)}
          nota="Saiu para entrega e ainda não foi entregue."
          dica="Mesma regra da aba Hoje: cargas que saíram para entrega e ainda não foram entregues. Inclui quem recebeu ocorrência depois da saída (ausente, recusa, pendência…), que também aparece em Travado em ocorrência, e quem foi baixado sem entrega. Vendo por Saída para entrega, é o total de CT-e menos os entregues."
          aoClicar={() => {
            aoAbrir("em_rota");
          }}
        />
        <TotCard
          rotulo="Entregues"
          tom="positive"
          valor={n(t?.entregues)}
          base={pctBase(t?.entregues ?? 0) ?? "sem base no período"}
          dica="Cargas com entrega confirmada ao destinatário. Conta todo o período; nas abas de Performance o mesmo indicador considera só as cargas que já saíram para entrega, por isso os números podem diferir levemente."
          aoClicar={() => {
            aoAbrir("entregues");
          }}
        />
        {!cardsSecundarios.ocultos && (
          <TotCard
            rotulo="Baixado sem entrega"
            tom="alert"
            valor={n(t?.baixadoSemEntrega)}
            base={pctBase(t?.baixadoSemEntrega ?? 0)}
            dica="Cargas encerradas por baixa formal, sem entrega: devolução ao parceiro, coleta cancelada, mercadoria indenizada, confiscada ou liberada pelo seguro, CTRC substituído, cancelado ou emitido só para efeito de frete. NÃO é a mesma coisa que a Taxa de retorno das abas de Performance, que conta cargas que voltaram com o código 13 — por isso os dois números são diferentes."
            aoClicar={() => {
              aoAbrir("devolvido");
            }}
          />
        )}
        <TotCard
          rotulo="Travado em ocorrência"
          tom="alert"
          valor={n(t?.travado)}
          base={
            t?.travadoMotivo
              ? `Principal: ${t.travadoMotivo.toLowerCase()}`
              : pctBase(t?.travado ?? 0)
          }
          dica={`Cargas com pendência do cliente ou da operação que ainda não saíram de novo para entrega. Só uma nova saída para entrega tira a carga daqui; agendamento, chegada na unidade ou "pendência solucionada" não bastam.${t?.travadoMotivo ? ` Motivo mais frequente: ${t.travadoMotivo.toLowerCase()}.` : ""}`}
          aoClicar={() => {
            aoAbrir("travado");
          }}
        />
        {verTodos && !cardsSecundarios.ocultos && (
          <TotCard
            rotulo="Parado sem saída"
            tom="alert"
            valor={n(t?.parado)}
            base={pctBase(t?.parado ?? 0)}
            dica="Cargas que ainda não saíram para entrega e nunca tiveram pendência, incluindo as recém-criadas sem nenhuma movimentação registrada: seguem na unidade aguardando programação. Carga com pendência fica em Travado em ocorrência."
            aoClicar={() => {
              aoAbrir("parado");
            }}
          />
        )}
        <TotCard
          rotulo="TDE romaneado"
          valor={n(t?.tdeRomaneado)}
          base={`${n(t?.tdeRomaneadoEmRota)} em rota · ${n(t?.tdeRomaneadoEntregue)} entregues · ${fmtMoeda(t?.tdeRomaneadoValor ?? 0)} de TDE · ${n(t?.tdeCtes)} CTRC com TDE no período`}
          dica="Cargas com TDE (taxa de dificuldade de entrega, do relatório 455) que já saíram para entrega: em rota ou entregues. As que ainda aguardam programação estão no card “TDE aguardando programação” da tela Performance."
          aoClicar={() => {
            aoAbrir("tde_romaneado");
          }}
        />
        {otifVisivel && (
          <TotCard
            rotulo="CTRC com problema (OTIF)"
            tom="alert"
            valor={otifPct == null ? "—" : formatarPercentual(otifPct, { escala: "cem" })}
            base={`${n(t?.otifProblemas)} CTRC`}
            dica="De cada 100 cargas do período, quantas tiveram algum problema no percurso — pendência do cliente ou da operação — mesmo que tenham sido entregues no prazo. Quanto menor, melhor."
            aoClicar={() => {
              aoAbrir("otif");
            }}
          />
        )}
        <TotCard
          rotulo="Prejuízo"
          valor={fmtMoeda(t?.prejuizoFrete ?? 0)}
          base={`${n(t?.prejuizoCtes)} CTRC`}
          dica="Frete das cargas com problema de responsabilidade da transportadora no período."
          aoClicar={() => {
            aoAbrir("prejuizo");
          }}
        />
      </GradeCards>
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
        <span className="text-muted-foreground">
          Em rota, por prazo{!verTodos ? " (somente romaneados)" : ""}:
        </span>
        <FaixaChip
          rotulo="Vencida"
          valor={t?.emRotaVencida ?? 0}
          tom="ruim"
          aoClicar={() => {
            aoAbrir("em_rota_vencida");
          }}
        />
        <FaixaChip
          rotulo="Vencendo no dia"
          valor={t?.emRotaHoje ?? 0}
          tom="alerta"
          aoClicar={() => {
            aoAbrir("em_rota_hoje");
          }}
        />
        <FaixaChip
          rotulo="Vencimento futuro"
          valor={t?.emRotaFuturo ?? 0}
          tom="ok"
          aoClicar={() => {
            aoAbrir("em_rota_futuro");
          }}
        />
        <button
          type="button"
          className="text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => {
            aoAbrir("em_rota_sem_prev");
          }}
        >
          sem prazo definido: {n(t?.emRotaSemPrev)}
        </button>
        <span className="ml-auto">
          <AlternarCardsSecundarios
            ocultos={cardsSecundarios.ocultos}
            quantos={verTodos ? 2 : 1}
            aoClicar={cardsSecundarios.alternar}
          />
        </span>
      </div>
    </div>
  );
}
