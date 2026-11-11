/**
 * Peças visuais do Romaneio no desenho do painel (docs/design/guia.md): indicador com explicação,
 * faixas de prazo em barra empilhada, trilho de barra horizontal, tabela própria com o visual da
 * `TabelaDados`, seletor da lista e campo de texto adiado.
 */
import { formatarInteiro, formatarPercentual } from "@erp/shared/formatacao";
import { Eye, EyeOff, Search } from "lucide-react";
import {
  Children,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";

import { Aviso } from "@/componentes/comum/Aviso";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { InfoTip } from "@/componentes/comum/InfoTip";
import { LinhasCarregando } from "@/componentes/comum/LinhasCarregando";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { CLASSE_DO_TOM, ICONE_DO_TOM, type Tom } from "@/componentes/comum/SeloStatus";
import { Button } from "@/componentes/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/componentes/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/componentes/ui/tooltip";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------------------------
// Dica e indicadores

/** Dica no passar do mouse (e no foco, quando o filho é focável). O filho é um elemento só. */
export function ComDica({
  texto,
  lado = "top",
  children,
}: {
  texto: ReactNode;
  lado?: "top" | "bottom";
  children: ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={lado} className="max-w-[320px] text-[12px] leading-snug">
          {texto}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Grade de indicadores em linhas iguais (8 = 4 + 4, 9 = 3 + 3 + 3): nenhum card sozinho na linha.
 * Conta só os filhos que de fato aparecem.
 */
export function GradeDeIndicadores({ max = 4, children }: { max?: number; children: ReactNode }) {
  const n = Math.max(1, Children.toArray(children).length);
  const colunas = (limite: number) => Math.ceil(n / Math.ceil(n / limite));
  const estilo: CSSProperties & Record<"--cols-sm" | "--cols-xl", number> = {
    "--cols-sm": colunas(2),
    "--cols-xl": colunas(max),
  };
  return (
    <div
      className="grid gap-4 sm:[grid-template-columns:repeat(var(--cols-sm),minmax(0,1fr))] xl:[grid-template-columns:repeat(var(--cols-xl),minmax(0,1fr))]"
      style={estilo}
    >
      {children}
    </div>
  );
}

const CHAVE_OCULTOS = "romaneio:cards-ocultos";

/**
 * "Baixado sem entrega" e "Parado sem saída" ficam ocultos por padrão, com opção de reexibir.
 * A escolha fica no navegador e vale para todas as abas.
 */
export function useCardsSecundarios() {
  const [ocultos, setOcultos] = useState(true);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(CHAVE_OCULTOS) === "0") setOcultos(false);
    } catch {
      // sem acesso ao armazenamento: fica o padrão (ocultos)
    }
  }, []);
  const alternar = () => {
    setOcultos((atual) => {
      try {
        window.localStorage.setItem(CHAVE_OCULTOS, atual ? "0" : "1");
      } catch {
        // sem armazenamento: vale só nesta visita
      }
      return !atual;
    });
  };
  return { ocultos, alternar };
}

export function AlternarCardsSecundarios({
  ocultos,
  quantos,
  aoClicar,
}: {
  ocultos: boolean;
  quantos: number;
  aoClicar: () => void;
}) {
  const Icone = ocultos ? Eye : EyeOff;
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={aoClicar}
      className="h-auto min-h-8 text-[12.5px] font-medium whitespace-normal text-muted-foreground hover:text-foreground"
    >
      <Icone aria-hidden />
      {ocultos
        ? `Mostrar ${quantos === 1 ? "card oculto" : `${quantos} cards ocultos`} (Baixado sem entrega${quantos > 1 ? ", Parado sem saída" : ""})`
        : "Ocultar Baixado sem entrega e Parado sem saída"}
    </Button>
  );
}

// ---------------------------------------------------------------------------------------------
// Faixas de prazo (barra empilhada 100% + chips que abrem a lista)

export type ChaveDaFaixa = "vencida" | "hoje" | "futuro" | "sem_prev";

interface ContagemDasFaixas {
  vencida: number;
  hoje: number;
  futuro: number;
  semPrev: number;
}

const FAIXAS: readonly {
  chave: Exclude<ChaveDaFaixa, "sem_prev">;
  rotulo: string;
  tom: Tom;
  cor: string;
}[] = [
  { chave: "vencida", rotulo: "Vencida", tom: "erro", cor: "var(--status-bad)" },
  { chave: "hoje", rotulo: "Vencendo no dia", tom: "alerta", cor: "var(--status-warn)" },
  { chave: "futuro", rotulo: "Vencimento futuro", tom: "sucesso", cor: "var(--status-good)" },
];

/**
 * Uma linha de faixas de prazo: título, barra empilhada (dica no mouse) e um chip por faixa.
 * Os chips são os botões (teclado); a barra mostra a proporção.
 */
export function FaixasDePrazo({
  rotulo,
  dica,
  faixas,
  aoAbrir,
}: {
  rotulo: ReactNode;
  dica?: string | undefined;
  faixas: ContagemDasFaixas | undefined;
  aoAbrir: (faixa: ChaveDaFaixa) => void;
}) {
  const f = faixas ?? { vencida: 0, hoje: 0, futuro: 0, semPrev: 0 };
  const total = f.vencida + f.hoje + f.futuro + f.semPrev;
  const segmentos = [
    ...FAIXAS.map((x) => ({ chave: x.chave, rotulo: x.rotulo, cor: x.cor, valor: f[x.chave] })),
    {
      chave: "sem_prev",
      rotulo: "Sem prazo definido",
      cor: "var(--muted-foreground)",
      valor: f.semPrev,
    },
  ].filter((s) => s.valor > 0);
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
        <span>{rotulo}</span>
        {dica && <InfoTip texto={dica} />}
      </div>
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
        {total > 0 &&
          segmentos.map((s) => (
            <ComDica
              key={s.chave}
              texto={`${s.rotulo}: ${formatarInteiro(s.valor)} (${formatarPercentual(s.valor / total)})`}
            >
              <span
                className="h-full transition-opacity hover:opacity-80"
                style={{ flexGrow: s.valor, flexBasis: 0, background: s.cor }}
              />
            </ComDica>
          ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {FAIXAS.map((x) => {
          const Icone = ICONE_DO_TOM[x.tom];
          return (
            <button
              key={x.chave}
              type="button"
              onClick={() => {
                aoAbrir(x.chave);
              }}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium transition-[filter] hover:brightness-95",
                CLASSE_DO_TOM[x.tom],
              )}
            >
              <Icone className="h-3.5 w-3.5" aria-hidden />
              {x.rotulo}
              <span className="font-bold tabular-nums">{formatarInteiro(f[x.chave])}</span>
            </button>
          );
        })}
        <button
          type="button"
          className="h-7 rounded-full px-2 text-[12.5px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => {
            aoAbrir("sem_prev");
          }}
        >
          sem prazo definido: {formatarInteiro(f.semPrev)}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Barras horizontais

/** Trilho com a barra proporcional (as linhas de barras são botões; o trilho é só desenho). */
export function Trilho({
  fracao,
  cor = "var(--brand)",
  className,
}: {
  fracao: number;
  cor?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <span aria-hidden className={cn("block h-2 overflow-hidden rounded-full bg-muted", className)}>
      <span
        className="block h-full rounded-full"
        // Barra mínima visível: um item com 1 ao lado de outro com mil não some.
        style={{ width: fracao > 0 ? `max(3px, ${fracao * 100}%)` : 0, background: cor }}
      />
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// Tabela própria com o visual da TabelaDados (cabeçalhos com dica, colunas dinâmicas)

export function TabelaPropria({
  className,
  children,
}: {
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className={cn("rolagem-fina overflow-x-auto", className)}>
      <table className="w-full text-[13px] tabular-nums">{children}</table>
    </div>
  );
}

/** Linha de cabeçalho (fundo `muted`, rótulos em caixa alta). */
export function Cabecalho({
  fixo,
  children,
}: {
  /** Gruda no topo da área com rolagem. */
  fixo?: boolean | undefined;
  children: ReactNode;
}) {
  return (
    <thead className={cn(fixo && "sticky top-0 z-[6]")}>
      <tr className="border-b border-border bg-muted text-muted-foreground">{children}</tr>
    </thead>
  );
}

export function Th({
  direita,
  className,
  style,
  children,
}: {
  direita?: boolean | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  children?: ReactNode;
}) {
  return (
    <th
      scope="col"
      style={style}
      className={cn(
        "px-4 py-2.5 align-bottom text-[11.5px] font-semibold tracking-[0.04em] whitespace-nowrap uppercase",
        direita ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

/** Título de coluna com dica ("i"); a dica não reordena nem abre nada. */
export function TituloComDica({ dica, children }: { dica: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <InfoTip texto={dica} />
    </span>
  );
}

export const CLASSE_TD = "px-4 py-2.5 whitespace-nowrap";
export const CLASSE_NUMERO = "px-4 py-2.5 text-right tabular-nums whitespace-nowrap";
/** Documento, placa, sigla. */
export const CLASSE_CODIGO = "px-4 py-2.5 font-mono text-[12px] whitespace-nowrap";

/**
 * Linha da tabela; com `aoClicar` vira clicável pelo mouse e pelo teclado (Enter/Espaço na
 * própria linha, não nos botões de dentro dela).
 */
export function propsDaLinha(aoClicar: (() => void) | undefined, classe?: string) {
  const base = cn(
    "border-b border-border transition-colors last:border-0 hover:bg-muted/60",
    aoClicar && "cursor-pointer focus-visible:bg-accent focus-visible:outline-none",
    classe,
  );
  if (!aoClicar) return { className: base };
  return {
    className: base,
    tabIndex: 0,
    onClick: aoClicar,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        aoClicar();
      }
    },
  };
}

/** Carregando (esqueleto), erro (com "Tentar novamente") e vazio no corpo da tabela. */
export function EstadoDaTabela({
  colunas,
  carregando,
  erro,
  aoTentarDeNovo,
  vazio,
  mensagem,
}: {
  colunas: number;
  carregando: boolean;
  erro?: unknown;
  aoTentarDeNovo?: (() => void) | undefined;
  vazio: boolean;
  mensagem: string;
}) {
  if (carregando) return <LinhasCarregando linhas={5} colunas={colunas} />;
  if (erro !== undefined && erro !== null) {
    return (
      <tr>
        <td colSpan={colunas}>
          <MensagemErro erro={erro} aoTentarDeNovo={aoTentarDeNovo} />
        </td>
      </tr>
    );
  }
  if (!vazio) return null;
  return (
    <tr>
      <td colSpan={colunas}>
        <EstadoVazio mensagem={mensagem} />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------------------------
// Prejuízo

/** Códigos que contam como prejuízo: os do filtro, senão o 13. */
const codigosDoPrejuizo = (codigos: readonly number[] | undefined) =>
  codigos && codigos.length > 0 ? codigos : [13];

/** "código 13" ou "códigos 13, 69". */
export function textoDoPrejuizo(codigos: readonly number[] | undefined): string {
  const lista = codigosDoPrejuizo(codigos);
  return `${lista.length > 1 ? "códigos" : "código"} ${lista.join(", ")}`;
}

/** "código 13" sob o título da coluna de prejuízo. */
export function PrejuizoSubtitulo({ codigos }: { codigos?: readonly number[] | undefined }) {
  return (
    <span className="block text-[12px] font-normal tracking-normal normal-case">
      {textoDoPrejuizo(codigos)}
    </span>
  );
}

/** Aviso quando há filtro de código ativo (prejuízo atribuído). */
export function AtribuicaoLegenda({ codigos }: { codigos?: readonly number[] | undefined }) {
  if (!codigos || codigos.length === 0) return null;
  return (
    <Aviso tom="info">
      Prejuízo atribuído ao(s) código(s) selecionado(s): {codigos.map((c) => `#${c}`).join(", ")} —
      conta apenas os CT-e cuja ocorrência penalizante é um desses códigos.
    </Aviso>
  );
}

// ---------------------------------------------------------------------------------------------
// Controles

/**
 * Seletor de uma opção no desenho dos filtros ("Situação: Todas"); destaca quando sai do padrão
 * (a primeira opção). `resumo` troca o texto mostrado no botão (a lista mantém o texto completo).
 */
export function SeletorDaLista<V extends string>({
  rotulo,
  valor,
  opcoes,
  aoMudar,
  resumo,
  padrao = opcoes[0]?.valor,
}: {
  rotulo: string;
  valor: V;
  opcoes: readonly { valor: V; rotulo: string }[];
  aoMudar: (v: V) => void;
  resumo?: string | undefined;
  padrao?: V | undefined;
}) {
  const ativo = valor !== padrao;
  return (
    <Select
      value={valor}
      onValueChange={(v) => {
        const escolhida = opcoes.find((o) => o.valor === v);
        if (escolhida) aoMudar(escolhida.valor);
      }}
    >
      <SelectTrigger
        className={cn(
          "h-9 w-auto max-w-full gap-2 border-border text-[13px] font-medium shadow-cartao",
          ativo && "border-brand/60 bg-brand-suave",
        )}
      >
        <span className="shrink-0 text-muted-foreground">{rotulo}:</span>
        <SelectValue>{resumo}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {opcoes.map((o) => (
          <SelectItem key={o.valor} value={o.valor} className="text-[13px]">
            {o.rotulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Campo de texto que grava na URL após uma pausa na digitação (CTRC, nota fiscal, busca da
 * lista). Acompanha a URL quando o filtro é limpo por fora (etiqueta, "Limpar filtros").
 */
export function CampoAdiado({
  valor,
  aoMudar,
  placeholder,
  className,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [texto, setTexto] = useState(valor);
  const [daUrl, setDaUrl] = useState(valor);
  if (valor !== daUrl) {
    setDaUrl(valor);
    if (valor !== texto.trim()) setTexto(valor);
  }
  useEffect(() => {
    const limpo = texto.trim();
    if (limpo === valor) return;
    const espera = setTimeout(() => {
      aoMudar(limpo);
    }, 400);
    return () => {
      clearTimeout(espera);
    };
  }, [texto, valor, aoMudar]);
  return (
    <CaixaDeBusca
      valor={texto}
      aoMudar={setTexto}
      placeholder={placeholder}
      rotulo={placeholder.replace(/[.…]+$/, "")}
      ativo={valor !== ""}
      className={className}
    />
  );
}

/** Caixa de texto com lupa, no desenho dos filtros (36 px). */
export function CaixaDeBusca({
  valor,
  aoMudar,
  placeholder,
  rotulo,
  ativo,
  className,
  children,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  placeholder: string;
  rotulo: string;
  ativo?: boolean | undefined;
  className?: string | undefined;
  /** Botão à direita dentro da caixa (ex.: limpar). */
  children?: ReactNode;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        value={valor}
        onChange={(e) => {
          aoMudar(e.target.value);
        }}
        placeholder={placeholder}
        aria-label={rotulo}
        className={cn(
          "h-9 w-full rounded-lg border border-border bg-card pr-8 pl-9 text-[13px] shadow-cartao outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
          ativo && "border-brand/60 bg-brand-suave",
        )}
      />
      {children}
    </div>
  );
}
