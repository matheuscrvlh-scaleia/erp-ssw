import {
  FAIXAS_ATRASO,
  type FiltroPrazo,
  type PainelDeOcorrencias,
} from "@erp/shared/contracts/occurrences";
import { formatarParticipacao } from "@erp/shared/formatting";
import { CalendarClock, Hourglass, Users } from "lucide-react";

import { type RecortesDosBlocos, ROTULO_DA_FAIXA } from "../search";
import { LinhaDeBarra } from "./BarRow";
import { Bloco } from "./Block";
import { SemDados } from "./NoData";
import { Esqueletos } from "./Skeletons";

/** Prazo, faixas de atraso e pagador: mais abaixo, como apoio. */
export function BlocosApoio({
  painel,
  carregando,
  r,
}: {
  painel: PainelDeOcorrencias | undefined;
  carregando: boolean;
  r: RecortesDosBlocos;
}) {
  const prazo = painel?.prazo;
  const totalPrazo = prazo ? prazo.noPrazo + prazo.foraPrazo + prazo.semPrazo : 0;
  const faixas = painel?.faixasAtraso;
  const valoresFaixas = faixas ? FAIXAS_ATRASO.map((f) => faixas[f]) : [];
  const maxFaixa = Math.max(1, ...valoresFaixas);
  const totalFaixas = valoresFaixas.reduce((s, v) => s + v, 0);
  const pagadores = painel?.porPagador ?? [];
  const maxPagador = Math.max(1, ...pagadores.map((p) => p.ctrcs));
  const totalCtes = painel?.metricas.ctrcs ?? 0;

  const linhaDePrazo = (chave: FiltroPrazo, rotulo: string, valor: number) => (
    <LinhaDeBarra
      key={chave}
      rotulo={rotulo}
      valor={valor}
      maximo={totalPrazo}
      ativo={r.prazo === chave}
      apoio={
        <span className="text-xs font-semibold text-muted-foreground">
          {formatarParticipacao(valor, totalPrazo)}
        </span>
      }
      aoClicar={() => {
        r.aoPrazo(r.prazo === chave ? null : chave);
      }}
    />
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Bloco
        titulo="Prazo"
        icone={CalendarClock}
        dica="Conta CT-e distintos que tiveram ocorrência no período — um CT-e com 5 ocorrências conta uma vez. 'Prazo não apurado' são CT-e ainda em aberto ou baixados sem entrega: o prazo só é apurado na entrega."
      >
        {carregando && <Esqueletos n={3} />}
        {!carregando && totalPrazo === 0 && <SemDados />}
        {!carregando && prazo && totalPrazo > 0 && (
          <>
            {linhaDePrazo("no_prazo", "No prazo", prazo.noPrazo)}
            {linhaDePrazo("fora_prazo", "Fora do prazo", prazo.foraPrazo)}
            {linhaDePrazo("sem_prazo", "Prazo não apurado", prazo.semPrazo)}
          </>
        )}
      </Bloco>

      <Bloco
        titulo="Faixas de atraso"
        icone={Hourglass}
        dica="CT-e distintos com ocorrência, ainda em aberto e com a previsão de entrega vencida, agrupados pelos dias desde a previsão. Entregues e baixados sem entrega não entram. O percentual considera todos os CT-e destas faixas."
      >
        {carregando && <Esqueletos />}
        {!carregando && totalFaixas === 0 && <SemDados />}
        {!carregando &&
          faixas &&
          FAIXAS_ATRASO.filter((f) => faixas[f] > 0).map((f) => (
            <LinhaDeBarra
              key={f}
              rotulo={ROTULO_DA_FAIXA[f]}
              valor={faixas[f]}
              maximo={maxFaixa}
              total={totalFaixas}
              ativo={r.faixa === f}
              aoClicar={() => {
                r.aoFaixa(r.faixa === f ? null : f);
              }}
            />
          ))}
      </Bloco>

      <Bloco
        titulo="CT-e por pagador"
        icone={Users}
        dica="Top 15 pagadores por CT-e distintos com ocorrência. O percentual considera todos os CT-e com ocorrência do recorte, incluindo pagadores fora do top 15."
      >
        {carregando && <Esqueletos />}
        {!carregando && pagadores.length === 0 && <SemDados />}
        {!carregando &&
          pagadores.map((p) => (
            <LinhaDeBarra
              key={p.pagador}
              rotulo={p.pagador}
              valor={p.ctrcs}
              maximo={maxPagador}
              total={totalCtes}
              ativo={r.pagador === p.pagador}
              aoClicar={() => {
                r.aoPagador(r.pagador === p.pagador ? null : p.pagador);
              }}
            />
          ))}
      </Bloco>
    </div>
  );
}
