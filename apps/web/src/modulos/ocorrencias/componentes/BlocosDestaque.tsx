import { type PainelDeOcorrencias } from "@erp/shared/contratos/ocorrencias";
import { formatarInteiro } from "@erp/shared/formatacao";
import { CircleCheckBig, ListOrdered, MapPin, Minus, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

import { type RecortesDosBlocos } from "../busca";
import { rotulosDoResponsavel } from "../textos";
import { Bloco } from "./Bloco";
import { Esqueletos } from "./Esqueletos";
import { LinhaDeBarra } from "./LinhaDeBarra";
import { SeloDoResponsavel } from "./SeloDoResponsavel";
import { SemDados } from "./SemDados";

/** Variação contra o mês anterior: piora em vermelho, melhora em verde (com seta, não só cor). */
function SeloDeVariacao({ delta }: { delta: number }) {
  const Icone = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-px text-xs font-bold tabular-nums",
        delta > 0
          ? "bg-status-bad-bg text-status-bad-fg"
          : delta < 0
            ? "bg-status-good-bg text-status-good-fg"
            : "bg-muted text-muted-foreground",
      )}
    >
      <Icone className="h-3 w-3" aria-hidden />
      {delta > 0 ? `+${formatarInteiro(delta)}` : formatarInteiro(delta)} vs anterior
    </span>
  );
}

/** Mais frequentes, finalizados × em aberto e onde atuar. */
export function BlocosDestaque({
  painel,
  carregando,
  nomeCurto,
  r,
}: {
  painel: PainelDeOcorrencias | undefined;
  carregando: boolean;
  nomeCurto: string;
  r: RecortesDosBlocos;
}) {
  const rotulos = rotulosDoResponsavel(nomeCurto);
  const total = painel?.metricas.total ?? 0;
  const codigos = painel?.topCodigos ?? [];
  const maxCodigo = Math.max(1, ...codigos.map((c) => c.count));
  const unidades = painel?.ondeAtuar ?? [];
  const maxUnidade = Math.max(1, ...unidades.map((u) => u.ocorrencias));
  const fin = painel?.finalizacao;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <Bloco
        titulo="Ocorrências mais frequentes"
        icone={ListOrdered}
        dica="Top 10 códigos por quantidade de ocorrências (cada ocorrência conta, não o CT-e). Percentual sobre todas as ocorrências do recorte. A variação compara com as mesmas datas do mês anterior, com os mesmos filtros."
      >
        {carregando && <Esqueletos />}
        {!carregando && codigos.length === 0 && <SemDados />}
        {!carregando &&
          codigos.map((c) => (
            <LinhaDeBarra
              key={c.codigo}
              rotulo={
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-muted-foreground">
                    #{c.codigo}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{c.descricao}</span>
                  <SeloDoResponsavel responsavel={c.responsavel}>
                    {rotulos[c.responsavel]}
                  </SeloDoResponsavel>
                </span>
              }
              valor={c.count}
              maximo={maxCodigo}
              total={total}
              tom={c.penaliza ? "ruim" : c.pendente ? "alerta" : "neutro"}
              ativo={r.codigo === c.codigo}
              apoio={<SeloDeVariacao delta={c.delta} />}
              aoClicar={() => {
                r.aoCodigo(r.codigo === c.codigo ? null : c.codigo);
              }}
            />
          ))}
      </Bloco>

      <Bloco
        titulo="CT-e finalizados e em aberto"
        icone={CircleCheckBig}
        dica="Todos os CT-e que tiveram ocorrência no recorte, cada um contado uma vez, pela situação atual. Entregues: ocorrência 1, 18 ou 67 (ou data de entrega). Baixados sem entrega: códigos de baixa do cadastro da empresa. Em aberto: o restante; 'em atraso' são os que já passaram da previsão de entrega."
      >
        {carregando && <Esqueletos n={3} />}
        {!carregando && (!fin || fin.ctrcs === 0) && <SemDados />}
        {!carregando && fin && fin.ctrcs > 0 && (
          <>
            <li className="px-3 pt-1 pb-1.5 text-[13px] font-semibold text-muted-foreground">
              {formatarInteiro(fin.ctrcs)} CT-e com ocorrência
            </li>
            <LinhaDeBarra
              rotulo="Finalizados — entregues"
              valor={fin.entregues}
              maximo={fin.ctrcs}
              total={fin.ctrcs}
              tom="bom"
              aoClicar={() => {
                r.aoFinalizacao("ocorr_entregues");
              }}
            />
            <LinhaDeBarra
              rotulo="Finalizados — baixados sem entrega"
              valor={fin.baixados}
              maximo={fin.ctrcs}
              total={fin.ctrcs}
              aoClicar={() => {
                r.aoFinalizacao("ocorr_baixados");
              }}
            />
            <LinhaDeBarra
              rotulo="Em aberto"
              valor={fin.emAberto}
              maximo={fin.ctrcs}
              total={fin.ctrcs}
              tom="alerta"
              aoClicar={() => {
                r.aoFinalizacao("ocorr_abertos");
              }}
              apoio={
                // Dentro do botão da linha: abre só os em atraso, sem disparar o "em aberto".
                <span
                  role="link"
                  tabIndex={0}
                  title="Ver os CT-e em atraso"
                  onClick={(e) => {
                    e.stopPropagation();
                    r.aoFinalizacao("ocorr_em_atraso");
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    e.stopPropagation();
                    r.aoFinalizacao("ocorr_em_atraso");
                  }}
                  className="rounded px-1 text-xs font-bold text-status-bad-fg tabular-nums underline-offset-2 hover:underline"
                >
                  {formatarInteiro(fin.emAtraso)} em atraso
                </span>
              }
            />
          </>
        )}
      </Bloco>

      <Bloco
        titulo="Onde atuar"
        icone={MapPin}
        dica={`Unidade responsável pelo CT-e (destino, senão local atual, senão filial emissora). Percentual sobre todas as ocorrências do recorte. 'penal.' conta as ocorrências de responsabilidade da ${nomeCurto} em CT-e ainda em atraso (mesma regra do card Penalizantes); ordenado por elas.`}
      >
        {carregando && <Esqueletos />}
        {!carregando && unidades.length === 0 && <SemDados />}
        {!carregando &&
          unidades.map((u) => (
            <LinhaDeBarra
              key={u.unidade}
              rotulo={<span className="font-mono">{u.unidade}</span>}
              valor={u.ocorrencias}
              maximo={maxUnidade}
              total={total}
              tom={u.penalizantes > 0 ? "ruim" : "neutro"}
              ativo={r.unidadeResp === u.unidade}
              apoio={
                <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                  {formatarInteiro(u.penalizantes)} penal. · {formatarInteiro(u.ctrcs)} CT-e
                </span>
              }
              aoClicar={() => {
                r.aoUnidadeResp(r.unidadeResp === u.unidade ? null : u.unidade);
              }}
            />
          ))}
      </Bloco>
    </div>
  );
}
