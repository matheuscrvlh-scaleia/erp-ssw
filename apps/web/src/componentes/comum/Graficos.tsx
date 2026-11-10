import { type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";

import { type FormatoColuna, textoDaCelula } from "@/lib/exportacao";

import { EstadoVazio } from "./EstadoVazio";
import { MensagemErro } from "./MensagemErro";

/**
 * Gráficos de linha e de barras com o visual do painel: eixos sem linha, texto 10 px cinza, grade
 * só horizontal, cor da marca (`--brand`), dica em cartão. origem: SlaSerieChart.tsx e
 * ColetasGraficos.tsx (sistema atual).
 */

export interface SerieGrafico {
  /** Propriedade do ponto com o valor (null deixa um vão). */
  chave: string;
  /** Nome na legenda e na dica. */
  nome: string;
  /** Cor CSS. Padrão: `var(--brand)` na primeira série, depois as `--chart-*`. */
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

const CORES_SERIE = ["var(--brand)", "var(--chart-2)", "var(--chart-1)", "var(--chart-4)"];
const TICK = { fontSize: 10, fill: "var(--muted-foreground)" };
const MARGEM = { top: 8, right: 16, bottom: 4, left: 4 };

const corDa = (serie: SerieGrafico, i: number): string =>
  serie.cor ?? CORES_SERIE[i % CORES_SERIE.length] ?? "var(--brand)";

function formatarEixo(formato: FormatoColuna | undefined) {
  return (valor: number) =>
    formato === "percentual"
      ? `${Math.round(valor * 100)}%`
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
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-[12px] shadow-sm">
      {dica ? (
        dica(ponto)
      ) : (
        <>
          <div className="font-medium">{textoDaCelula(valorDe(ponto, eixoX))}</div>
          {series.map((s) => {
            const valor = valorDe(ponto, s.chave);
            return (
              <div key={s.chave} className="mt-0.5 tabular-nums">
                {s.nome}:{" "}
                <strong>
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

/** Carregando, erro e vazio ocupam a mesma altura do gráfico (a tela não pula). */
function Area<T extends object>({
  props,
  children,
}: {
  props: GraficoBaseProps<T>;
  children: ReactNode;
}) {
  const altura = props.altura ?? 260;
  const semDados =
    props.dados.length === 0 ||
    props.dados.every((p) => props.series.every((s) => valorDe(p, s.chave) == null));
  return (
    <div style={{ height: altura }} className="p-4" role="figure" aria-label={props.descricao}>
      {props.erro ? (
        <MensagemErro erro={props.erro} className="h-full" />
      ) : props.carregando ? (
        <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
          carregando…
        </div>
      ) : semDados ? (
        <EstadoVazio
          mensagem={props.mensagemVazia ?? "Sem dados para os filtros selecionados."}
          className="h-full"
        />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      )}
    </div>
  );
}

export interface GraficoLinhaProps<T extends object> extends GraficoBaseProps<T> {
  /** Linha tracejada de meta (mesma escala dos dados). */
  meta?: { valor: number; rotulo: string } | undefined;
}

export function GraficoLinha<T extends object>(props: GraficoLinhaProps<T>) {
  const { dados, eixoX, series, formato, dominioY, meta, dica } = props;
  return (
    <Area props={props}>
      <LineChart data={[...dados]} margin={MARGEM}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
        <XAxis dataKey={eixoX} tick={TICK} axisLine={false} tickLine={false} minTickGap={12} />
        <YAxis
          domain={dominioY ? [...dominioY] : ["auto", "auto"]}
          tick={TICK}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={formatarEixo(formato)}
        />
        {meta && (
          <ReferenceLine
            y={meta.valor}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            label={{
              value: meta.rotulo,
              position: "insideTopRight",
              fontSize: 10,
              fill: "var(--muted-foreground)",
            }}
          />
        )}
        <Tooltip
          cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.4 }}
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
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />}
        {series.map((s, i) => (
          <Line
            key={s.chave}
            type="monotone"
            dataKey={s.chave}
            name={s.nome}
            stroke={corDa(s, i)}
            strokeWidth={2}
            dot={dados.length <= 31 ? { r: 3, fill: corDa(s, i), strokeWidth: 0 } : false}
            activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </Area>
  );
}

export interface GraficoBarrasProps<T extends object> extends GraficoBaseProps<T> {
  /** Clique numa barra (ex.: abrir a lista daquele dia). */
  aoClicarBarra?: ((ponto: T) => void) | undefined;
}

export function GraficoBarras<T extends object>(props: GraficoBarrasProps<T>) {
  const { dados, eixoX, series, formato, dominioY, dica, aoClicarBarra } = props;
  const topoDaPilha = (i: number) => {
    const pilha = series[i]?.pilha;
    return !pilha || series.findLastIndex((s) => s.pilha === pilha) === i;
  };
  return (
    <Area props={props}>
      <BarChart data={[...dados]} margin={MARGEM}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
        <XAxis dataKey={eixoX} tick={TICK} axisLine={false} tickLine={false} minTickGap={12} />
        <YAxis
          domain={dominioY ? [...dominioY] : [0, "auto"]}
          tick={TICK}
          axisLine={false}
          tickLine={false}
          width={48}
          allowDecimals={formato !== "inteiro"}
          tickFormatter={formatarEixo(formato)}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
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
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />}
        {series.map((s, i) => (
          <Bar
            key={s.chave}
            dataKey={s.chave}
            name={s.nome}
            {...(s.pilha ? { stackId: s.pilha } : {})}
            fill={corDa(s, i)}
            radius={topoDaPilha(i) ? [4, 4, 0, 0] : 0}
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
    </Area>
  );
}
