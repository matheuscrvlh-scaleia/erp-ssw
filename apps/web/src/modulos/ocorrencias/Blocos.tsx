import {
  type CampoData,
  type FaixaAtraso,
  FAIXAS_ATRASO,
  type FiltroPrazo,
  type PainelDeOcorrencias,
} from "@erp/shared/contratos/ocorrencias";
import {
  formatarDecimal,
  formatarDiaMes,
  formatarInteiro,
  formatarParticipacao,
  formatarPercentual,
} from "@erp/shared/formatacao";
import {
  AlertTriangle,
  CalendarClock,
  ChartColumn,
  CircleCheckBig,
  Hourglass,
  ListOrdered,
  type LucideIcon,
  MapPin,
  Minus,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { type ReactNode } from "react";

import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { GraficoBarras } from "@/componentes/comum/Graficos";
import { InfoTip } from "@/componentes/comum/InfoTip";
import { Painel } from "@/componentes/comum/Painel";
import { Skeleton } from "@/componentes/ui/skeleton";
import { cn } from "@/lib/utils";

import { type RecorteFinalizacao, ROTULO_DA_FAIXA } from "./busca";
import { SeloDoResponsavel } from "./Lista";
import { rotulosDoResponsavel } from "./rotulos";

/** Recortes que os blocos aplicam na tela (clicar de novo desfaz). */
interface RecortesDosBlocos {
  prazo: FiltroPrazo | null;
  faixa: FaixaAtraso | null;
  pagador: string | null;
  codigo: number | null;
  unidadeResp: string | null;
  aoPrazo: (v: FiltroPrazo | null) => void;
  aoFaixa: (v: FaixaAtraso | null) => void;
  aoPagador: (v: string | null) => void;
  aoCodigo: (v: number | null) => void;
  aoUnidadeResp: (v: string | null) => void;
  aoFinalizacao: (v: RecorteFinalizacao) => void;
}

/** Título de bloco com a explicação no (i). */
function TituloComDica({ titulo, dica }: { titulo: string; dica: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {titulo}
      <InfoTip texto={dica} />
    </span>
  );
}

/** Bloco de barras horizontais clicáveis (cada linha recorta a tela). */
function Bloco({
  titulo,
  dica,
  icone,
  children,
}: {
  titulo: string;
  dica: string;
  icone: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Painel
      titulo={<TituloComDica titulo={titulo} dica={dica} />}
      icone={icone}
      classeDoCorpo="p-2"
    >
      <ul className="rolagem-fina max-h-[320px] space-y-1 overflow-auto">{children}</ul>
    </Painel>
  );
}

const COR_DA_BARRA = {
  ruim: "bg-status-bad",
  alerta: "bg-status-warn",
  bom: "bg-status-good",
  neutro: "bg-muted-foreground/45",
} as const;

function LinhaDeBarra({
  rotulo,
  valor,
  maximo,
  total,
  apoio,
  ativo,
  tom = "neutro",
  aoClicar,
}: {
  rotulo: ReactNode;
  valor: number;
  maximo: number;
  total?: number;
  apoio?: ReactNode;
  ativo?: boolean;
  tom?: keyof typeof COR_DA_BARRA;
  aoClicar?: () => void;
}) {
  const largura = maximo > 0 ? (valor / maximo) * 100 : 0;
  return (
    <li>
      <button
        type="button"
        onClick={aoClicar}
        disabled={!aoClicar}
        aria-pressed={ativo}
        className={cn(
          "block w-full rounded-lg border px-3 py-2 text-left transition-colors",
          ativo
            ? "border-brand bg-accent text-accent-foreground"
            : aoClicar
              ? "border-transparent hover:bg-muted"
              : "border-transparent",
        )}
      >
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <span className="min-w-0 flex-1 truncate">{rotulo}</span>
          <span className="font-bold tabular-nums">{formatarInteiro(valor)}</span>
          {total !== undefined && (
            <span className="text-xs font-semibold text-muted-foreground tabular-nums">
              {formatarParticipacao(valor, total)}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", COR_DA_BARRA[tom])}
              style={{ width: `${String(largura)}%` }}
            />
          </div>
          {apoio}
        </div>
      </button>
    </li>
  );
}

function SemDados() {
  return (
    <li>
      <EstadoVazio
        mensagem="Sem dados no período."
        detalhe="Amplie o período ou tire algum filtro."
        className="py-6"
      />
    </li>
  );
}

function Esqueletos({ n = 5 }: { n?: number }) {
  return Array.from({ length: n }, (_, i) => (
    <li key={i}>
      <Skeleton className="h-11 rounded-lg bg-muted" />
    </li>
  ));
}

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

/** Top 10 códigos: barra do período ao lado da barra das mesmas datas no mês anterior. */
export function ComparativoDoMes({
  painel,
  carregando,
  periodo,
  r,
}: {
  painel: PainelDeOcorrencias | undefined;
  carregando: boolean;
  periodo: { inicio: string; fim: string };
  r: RecortesDosBlocos;
}) {
  const anterior = painel?.periodoAnterior;
  const dados = (painel?.topCodigos ?? []).map((c) => ({
    rotulo: `#${String(c.codigo)}`,
    codigo: c.codigo,
    descricao: c.descricao,
    atual: c.count,
    anterior: c.countAnterior,
  }));
  return (
    <Painel
      titulo={
        <TituloComDica
          titulo="Ocorrências: mês atual × mês anterior"
          dica="Os 10 códigos com mais ocorrências no período, cada ocorrência contada (um CT-e com três 13 conta três vezes). A barra cinza são as mesmas datas um mês antes, com os mesmos filtros. Clique numa barra para filtrar a tela pelo código."
        />
      }
      descricao={carregando ? "carregando…" : "clique numa barra para filtrar pelo código"}
      icone={ChartColumn}
    >
      <GraficoBarras
        descricao="Ocorrências por código no período e nas mesmas datas do mês anterior"
        dados={dados}
        eixoX="rotulo"
        altura={300}
        formato="inteiro"
        carregando={carregando}
        mensagemVazia="Nenhuma ocorrência no recorte atual."
        series={[
          {
            chave: "atual",
            nome: `Atual (${formatarDiaMes(periodo.inicio)}–${formatarDiaMes(periodo.fim)})`,
            cor: "var(--brand)",
          },
          {
            chave: "anterior",
            nome: anterior
              ? `Mês anterior (${formatarDiaMes(anterior.inicio)}–${formatarDiaMes(anterior.fim)})`
              : "Mês anterior",
            cor: "var(--grafico-comparacao)",
          },
        ]}
        dica={(d) => (
          <div className="text-xs font-semibold">
            <p>
              {d.rotulo} {d.descricao}
            </p>
            <p>
              Atual {formatarInteiro(d.atual)} · anterior {formatarInteiro(d.anterior)}
            </p>
          </div>
        )}
        aoClicarBarra={(d) => {
          r.aoCodigo(r.codigo === d.codigo ? null : d.codigo);
        }}
      />
    </Painel>
  );
}

const fracao = (ocorrencias: number, ctes: number) => (ctes > 0 ? ocorrencias / ctes : null);

/** Impacto de cada código sobre os CT-e do período, com o mês anterior. */
export function ImpactoPorCodigo({
  painel,
  carregando,
  campoData,
  r,
}: {
  painel: PainelDeOcorrencias | undefined;
  carregando: boolean;
  campoData: CampoData;
  r: RecortesDosBlocos;
}) {
  const impacto = painel?.impacto;
  const linhas = impacto?.linhas ?? [];
  const ctes = impacto?.ctrcs ?? 0;
  const ctesAnterior = impacto?.ctrcsAnterior ?? 0;
  const base = campoData === "emissao" ? "emitidos" : "com previsão";
  const grade = "grid-cols-[70px_minmax(0,1fr)_100px_90px_100px_90px_90px]";
  const pct = (v: number | null) => (v === null ? "—" : formatarPercentual(v));
  return (
    <Painel
      titulo={
        <TituloComDica
          titulo="Impacto por código de ocorrência"
          dica={`% = quantidade de ocorrências do código ÷ total de CT-e ${base} no período (finalizados ou não). Conta cada ocorrência, não o CT-e: um CT-e com três ocorrências 13 entra três vezes. A comparação usa as mesmas datas do mês anterior, com os mesmos filtros. Clique numa linha para filtrar a tela.`}
        />
      }
      descricao={
        carregando
          ? "carregando…"
          : `${formatarInteiro(ctes)} CT-e ${base} no período · ${formatarInteiro(ctesAnterior)} no mês anterior`
      }
      icone={TrendingDown}
    >
      {!carregando && linhas.length === 0 && (
        <EstadoVazio
          mensagem="Sem ocorrências no período com os filtros atuais."
          detalhe="Amplie o período ou tire algum filtro."
        />
      )}
      {linhas.length > 0 && (
        <div className="rolagem-fina overflow-x-auto">
          <div className="min-w-[760px]">
            <div
              className={`grid ${grade} items-center gap-3 border-b border-border bg-muted/70 px-4 py-2.5 text-[11.5px] font-semibold tracking-[0.04em] text-muted-foreground uppercase`}
            >
              <span>Código</span>
              <span>Descrição</span>
              <span className="text-right">Ocorrências</span>
              <span className="text-right">% dos CT-e</span>
              <span className="text-right">Mês anterior</span>
              <span className="text-right">% anterior</span>
              <span className="text-right">Variação</span>
            </div>
            <ul className="rolagem-fina max-h-[420px] divide-y divide-border overflow-y-auto">
              {linhas.map((l) => {
                const atual = fracao(l.ocorrencias, ctes);
                const antes = fracao(l.ocorrenciasAnterior, ctesAnterior);
                const delta = atual !== null && antes !== null ? atual - antes : null;
                const ativo = r.codigo === l.codigo;
                const corDelta =
                  delta === null || Math.abs(delta) < 0.0005
                    ? "text-muted-foreground"
                    : delta > 0
                      ? "text-status-bad-fg"
                      : "text-status-good-fg";
                return (
                  <li key={l.codigo}>
                    <button
                      type="button"
                      aria-pressed={ativo}
                      title="Filtrar toda a tela por este código"
                      onClick={() => {
                        r.aoCodigo(ativo ? null : l.codigo);
                      }}
                      className={cn(
                        `grid w-full ${grade} items-center gap-3 px-4 py-2.5 text-left text-[13px] transition-colors`,
                        ativo ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
                      )}
                    >
                      <span className="inline-flex items-center gap-1 font-mono font-bold tabular-nums">
                        {l.penaliza && (
                          <AlertTriangle
                            className="h-3.5 w-3.5 text-status-bad"
                            aria-label="Penaliza"
                          />
                        )}
                        {l.codigo}
                      </span>
                      <span className="truncate font-medium">{l.descricao}</span>
                      <span className="text-right font-bold tabular-nums">
                        {formatarInteiro(l.ocorrencias)}
                      </span>
                      <span className="text-right font-bold tabular-nums">{pct(atual)}</span>
                      <span className="text-right text-muted-foreground tabular-nums">
                        {formatarInteiro(l.ocorrenciasAnterior)}
                      </span>
                      <span className="text-right text-muted-foreground tabular-nums">
                        {pct(antes)}
                      </span>
                      <span className={`text-right font-bold tabular-nums ${corDelta}`}>
                        {delta === null
                          ? "—"
                          : `${delta > 0 ? "+" : ""}${formatarDecimal(Math.round(delta * 1000) / 10)} p.p.`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </Painel>
  );
}
