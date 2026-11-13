import { type ReactNode, useId, useState } from "react";
import {
  Area as AreaRecharts,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";

import { Skeleton } from "@/components/ui/skeleton";
import { type FormatoColuna, textoDaCelula } from "@/lib/export";
import { cn } from "@/lib/utils";

import { EstadoVazio } from "./EmptyState";
import { MensagemErro } from "./ErrorMessage";

/**
 * Gráficos de linha e de barras do painel (docs/design/guia.md §Gráficos): grade só horizontal e
 * discreta, eixos sem linha, primeira série na cor da marca com área em degradê, crosshair e dica
 * em cartão, legenda clicável (esconde/mostra a série, também pelo teclado).
 * origem: SlaSerieChart.tsx e ColetasGraficos.tsx (sistema atual)
 */

interface SerieGrafico {
  /** Propriedade do ponto com o valor (null deixa um vão). */
  chave: string;
  /** Nome na legenda e na dica. */
  nome: string;
  /** Cor CSS. Padrão: `var(--brand)` na primeira série, depois `--serie-2`, `--serie-3`… */
  cor?: string | undefined;
  /** Barras com a mesma pilha ficam empilhadas. */
  pilha?: string | undefined;
}

interface GraficoBaseProps<T extends object> {
  dados: readonly T[];
  /** Propriedade do ponto usada como rótulo do eixo X. */
  eixoX: string;
  series: readonly SerieGrafico[];
  /** Formato dos valores no eixo Y e na dica (percentual = fração 0–1). */
  formato?: FormatoColuna | undefined;
  /** Domínio do eixo Y; padrão automático. */
  dominioY?: readonly [number | "auto", number | "auto"] | undefined;
  /** Altura da área do gráfico em px (padrão 260). */
  altura?: number | undefined;
  /** Dica própria do ponto; padrão: rótulo + valor de cada série. */
  dica?: ((ponto: T) => ReactNode) | undefined;
  carregando?: boolean | undefined;
  erro?: unknown;
  mensagemVazia?: string | undefined;
  /** Descrição para leitor de tela (o SVG em si não é legível). */
  descricao: string;
}

/** Ordem fixa (validada para daltonismo): marca, depois as séries 2… da paleta. */
const CORES_SERIE = [
  "var(--brand)",
  "var(--serie-2)",
  "var(--serie-3)",
  "var(--serie-4)",
  "var(--serie-7)",
  "var(--serie-5)",
];
const TICK = { fontSize: 11.5, fill: "var(--muted-foreground)" };
const MARGEM = { top: 12, right: 16, bottom: 4, left: 4 };

const corDa = (serie: SerieGrafico, i: number): string =>
  serie.cor ?? CORES_SERIE[i % CORES_SERIE.length] ?? "var(--brand)";

function formatarEixo(formato: FormatoColuna | undefined) {
  return (valor: number) =>
    formato === "percentual"
      ? `${String(Math.round(valor * 100))}%`
      : textoDaCelula(valor, formato === "moeda" ? "moeda" : "inteiro");
}

function valorDe(ponto: object, chave: string): unknown {
  const valor: unknown = Reflect.get(ponto, chave);
  return valor;
}

function Dica<T extends object>({
  props,
  dados,
  eixoX,
  series,
  formato,
  dica,
}: {
  props: TooltipContentProps;
  dados: readonly T[];
  eixoX: string;
  series: readonly SerieGrafico[];
  formato: FormatoColuna | undefined;
  dica: ((ponto: T) => ReactNode) | undefined;
}) {
  const ponto = props.active ? dados[Number(props.activeIndex)] : undefined;
  if (!ponto) return null;
  return (
    <div className="min-w-40 rounded-xl border border-border bg-popover px-3.5 py-2.5 text-[12.5px] text-popover-foreground shadow-flutuante">
      {dica ? (
        dica(ponto)
      ) : (
        <>
          <div className="label-xs mb-1.5">{textoDaCelula(valorDe(ponto, eixoX))}</div>
          {series.map((s, i) => {
            const valor = valorDe(ponto, s.chave);
            return (
              <div key={s.chave} className="flex items-center gap-2 py-0.5 tabular-nums">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ background: corDa(s, i) }}
                />
                <span className="flex-1 text-muted-foreground">{s.nome}</span>
                <strong className="font-semibold text-foreground">
                  {valor == null ? "sem dado" : textoDaCelula(valor, formato ?? "inteiro")}
                </strong>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/**
 * Legenda clicável: cada item é um botão que esconde/mostra a série (aria-pressed). A cor fica no
 * quadradinho; o texto fica na cor de texto (nunca só cor para identificar).
 */
function Legenda({
  series,
  ocultas,
  alternar,
}: {
  series: readonly SerieGrafico[];
  ocultas: ReadonlySet<string>;
  alternar: (chave: string) => void;
}) {
  if (series.length < 2) return null;
  return (
    <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 px-4 pt-3" data-exportacao-ignorar>
      {series.map((s, i) => {
        const oculta = ocultas.has(s.chave);
        return (
          <button
            key={s.chave}
            type="button"
            aria-pressed={!oculta}
            title={oculta ? `Mostrar ${s.nome}` : `Esconder ${s.nome}`}
            onClick={() => {
              alternar(s.chave);
            }}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-1 py-0.5 text-[12.5px] text-foreground transition-opacity hover:bg-muted",
              oculta && "opacity-45 line-through",
            )}
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-[3px]"
              style={{ background: corDa(s, i) }}
            />
            {s.nome}
          </button>
        );
      })}
    </div>
  );
}

function useSeriesOcultas() {
  const [ocultas, setOcultas] = useState<ReadonlySet<string>>(new Set());
  const alternar = (chave: string) => {
    setOcultas((atual) => {
      const nova = new Set(atual);
      if (nova.has(chave)) nova.delete(chave);
      else nova.add(chave);
      return nova;
    });
  };
  return { ocultas, alternar };
}

/** Carregando, erro e vazio ocupam a mesma altura do gráfico (a tela não pula). */
function Moldura<T extends object>({
  props,
  ocultas,
  alternar,
  children,
}: {
  props: GraficoBaseProps<T>;
  ocultas: ReadonlySet<string>;
  alternar: (chave: string) => void;
  children: ReactNode;
}) {
  const altura = props.altura ?? 260;
  const semDados =
    props.dados.length === 0 ||
    props.dados.every((p) => props.series.every((s) => valorDe(p, s.chave) == null));
  const pronto = !props.erro && !props.carregando && !semDados;
  return (
    <div role="figure" aria-label={props.descricao}>
      {pronto && <Legenda series={props.series} ocultas={ocultas} alternar={alternar} />}
      <div style={{ height: altura }} className="px-2 pt-2 pb-3">
        {props.erro ? (
          <MensagemErro erro={props.erro} className="h-full" />
        ) : props.carregando ? (
          <div className="flex h-full items-end gap-2 px-6 pb-6" aria-label="Carregando">
            {[40, 65, 50, 80, 60, 72, 45, 85, 55, 70].map((h, i) => (
              <Skeleton
                key={i}
                className="flex-1 rounded-md bg-muted"
                style={{ height: `${String(h)}%` }}
              />
            ))}
          </div>
        ) : semDados ? (
          <EstadoVazio
            mensagem={props.mensagemVazia ?? "Sem dados para os filtros selecionados."}
            detalhe="Amplie o período ou tire algum filtro."
            className="h-full"
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

interface GraficoLinhaProps<T extends object> extends GraficoBaseProps<T> {
  /** Linha tracejada de meta (mesma escala dos dados). */
  meta?: { valor: number; rotulo: string } | undefined;
}

export function GraficoLinha<T extends object>(props: GraficoLinhaProps<T>) {
  const { dados, eixoX, series, formato, dominioY, meta, dica } = props;
  const { ocultas, alternar } = useSeriesOcultas();
  const idDegrade = useId().replace(/:/g, "");
  return (
    <Moldura props={props} ocultas={ocultas} alternar={alternar}>
      <ComposedChart data={[...dados]} margin={MARGEM}>
        <defs>
          {series.map((s, i) => (
            <linearGradient
              key={s.chave}
              id={`${idDegrade}-${String(i)}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={corDa(s, i)} stopOpacity={0.22} />
              <stop offset="100%" stopColor={corDa(s, i)} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke="var(--grafico-grade)" />
        <XAxis
          dataKey={eixoX}
          tick={TICK}
          axisLine={false}
          tickLine={false}
          minTickGap={16}
          tickMargin={8}
        />
        <YAxis
          domain={dominioY ? [...dominioY] : ["auto", "auto"]}
          tick={TICK}
          axisLine={false}
          tickLine={false}
          width={formato === "moeda" ? 84 : 52}
          tickFormatter={formatarEixo(formato)}
        />
        {meta && (
          <ReferenceLine
            y={meta.valor}
            stroke="var(--muted-foreground)"
            strokeDasharray="5 5"
            label={{
              value: meta.rotulo,
              position: "insideTopRight",
              fontSize: 11.5,
              fill: "var(--muted-foreground)",
            }}
          />
        )}
        <Tooltip
          cursor={{ stroke: "var(--brand)", strokeOpacity: 0.1, strokeWidth: 28 }}
          content={(p: TooltipContentProps) => (
            <Dica
              props={p}
              dados={dados}
              eixoX={eixoX}
              series={series}
              formato={formato}
              dica={dica}
            />
          )}
        />
        {series.map((s, i) =>
          // A primeira série ganha a área em degradê (destaque, como "este período" no mockup).
          i === 0 ? (
            <AreaRecharts
              key={s.chave}
              type="monotone"
              dataKey={s.chave}
              name={s.nome}
              hide={ocultas.has(s.chave)}
              stroke={corDa(s, i)}
              strokeWidth={2.5}
              fill={`url(#${idDegrade}-${String(i)})`}
              dot={dados.length <= 31 ? { r: 3, fill: corDa(s, i), strokeWidth: 0 } : false}
              activeDot={{ r: 5.5, stroke: "var(--card)", strokeWidth: 2.5 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ) : (
            <Line
              key={s.chave}
              type="monotone"
              dataKey={s.chave}
              name={s.nome}
              hide={ocultas.has(s.chave)}
              stroke={corDa(s, i)}
              strokeWidth={2}
              dot={dados.length <= 31 ? { r: 3, fill: corDa(s, i), strokeWidth: 0 } : false}
              activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ),
        )}
      </ComposedChart>
    </Moldura>
  );
}

interface GraficoBarrasProps<T extends object> extends GraficoBaseProps<T> {
  /** Clique numa barra (ex.: abrir a lista daquele dia). */
  aoClicarBarra?: ((ponto: T) => void) | undefined;
}

export function GraficoBarras<T extends object>(props: GraficoBarrasProps<T>) {
  const { dados, eixoX, series, formato, dominioY, dica, aoClicarBarra } = props;
  const { ocultas, alternar } = useSeriesOcultas();
  const visiveis = series.filter((s) => !ocultas.has(s.chave));
  const topoDaPilha = (s: SerieGrafico) => {
    if (!s.pilha) return true;
    const daPilha = visiveis.filter((v) => v.pilha === s.pilha);
    return daPilha[daPilha.length - 1]?.chave === s.chave;
  };
  return (
    <Moldura props={props} ocultas={ocultas} alternar={alternar}>
      <BarChart data={[...dados]} margin={MARGEM} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke="var(--grafico-grade)" />
        <XAxis
          dataKey={eixoX}
          tick={TICK}
          axisLine={false}
          tickLine={false}
          minTickGap={16}
          tickMargin={8}
        />
        <YAxis
          domain={dominioY ? [...dominioY] : [0, "auto"]}
          tick={TICK}
          axisLine={false}
          tickLine={false}
          width={formato === "moeda" ? 84 : 52}
          allowDecimals={formato !== "inteiro"}
          tickFormatter={formatarEixo(formato)}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", fillOpacity: 0.7, radius: 6 }}
          content={(p: TooltipContentProps) => (
            <Dica
              props={p}
              dados={dados}
              eixoX={eixoX}
              series={series}
              formato={formato}
              dica={dica}
            />
          )}
        />
        {series.map((s, i) => (
          <Bar
            key={s.chave}
            dataKey={s.chave}
            name={s.nome}
            hide={ocultas.has(s.chave)}
            {...(s.pilha ? { stackId: s.pilha } : {})}
            fill={corDa(s, i)}
            maxBarSize={44}
            radius={topoDaPilha(s) ? [4, 4, 0, 0] : 0}
            stroke="var(--card)"
            strokeWidth={s.pilha ? 1 : 0}
            isAnimationActive={false}
            {...(aoClicarBarra
              ? {
                  cursor: "pointer",
                  onClick: (_dado: unknown, indice: number) => {
                    const ponto = dados[indice];
                    if (ponto) aoClicarBarra(ponto);
                  },
                }
              : {})}
          />
        ))}
      </BarChart>
    </Moldura>
  );
}
