import { formatarInteiro } from "@erp/shared/formatacao";
/**
 * Peças visuais próprias do Romaneio (cards de totalizador, chips de faixa). Visual da
 * tela de hoje (features/romaneio/TotCard.tsx, Fase2Views.tsx).
 */
import { Eye, EyeOff } from "lucide-react";
import {
  Children,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";

import { InfoTip } from "@/componentes/comum/InfoTip";
import { cn } from "@/lib/utils";

/** Props de clique acessível (card que vira botão). */
function clicavel(aoClicar: (() => void) | undefined) {
  if (!aoClicar) return {};
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: aoClicar,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        aoClicar();
      }
    },
  };
}

const CLICAVEL =
  "cursor-pointer transition-colors hover:border-[var(--brand)]/60 hover:bg-muted/50";

/** Card de totalizador do topo (e da aba Performance por romaneio). */
export function TotCard({
  rotulo,
  valor,
  base,
  dica,
  nota,
  tom = "volume",
  aoClicar,
}: {
  rotulo: string;
  valor: string;
  base?: string | undefined;
  dica?: string;
  nota?: string;
  tom?: "volume" | "alert" | "positive";
  aoClicar?: (() => void) | undefined;
}) {
  const acento =
    tom === "positive"
      ? "border-l-kpi-positive text-kpi-positive"
      : tom === "alert"
        ? "border-l-kpi-alert text-kpi-alert"
        : "border-l-kpi-volume text-kpi-volume";
  return (
    <div
      {...clicavel(aoClicar)}
      className={cn(
        "rounded-[10px] border border-border/70 border-l-[5px] bg-card px-3 py-2 text-left",
        acento,
        aoClicar && CLICAVEL,
      )}
    >
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-foreground">
        <span>{rotulo}</span>
        {dica && <InfoTip texto={dica} />}
      </div>
      <div className="mt-0.5 text-[20px] font-bold tabular-nums">{valor}</div>
      {base && <div className="mt-0.5 text-[10px] text-muted-foreground">{base}</div>}
      {nota && <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{nota}</div>}
    </div>
  );
}

export type Tom = "ok" | "ruim" | "alerta";

const COR_DO_TOM: Record<Tom | "neutro", string> = {
  ok: "var(--status-good)",
  alerta: "var(--status-warn)",
  ruim: "var(--status-bad)",
  neutro: "var(--kpi-positive)",
};

/** Card das abas (Hoje, Romaneio de entrega, Performance). `destaque` = número maior. */
export function CardAba({
  rotulo,
  valor,
  dica,
  tom,
  explicacao,
  sub,
  aoClicar,
  destaque,
}: {
  rotulo: string;
  valor: string;
  dica?: string | undefined;
  tom?: Tom | undefined;
  explicacao?: string;
  sub?: ReactNode;
  aoClicar?: (() => void) | undefined;
  destaque?: boolean;
}) {
  const acento = COR_DO_TOM[tom ?? "neutro"];
  return (
    <div
      {...clicavel(aoClicar)}
      style={{ borderLeftColor: acento }}
      className={cn(
        "rounded-[10px] border border-border/70 border-l-[5px] bg-card px-3 text-left",
        destaque ? "py-2.5" : "py-2",
        aoClicar && CLICAVEL,
      )}
    >
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{rotulo}</span>
        {explicacao && <InfoTip texto={explicacao} />}
      </div>
      {sub && <div className="leading-tight">{sub}</div>}
      <div
        className={cn(
          "mt-0.5 tabular-nums",
          destaque ? "text-[22px] font-semibold" : "text-[18px] font-medium",
        )}
        style={{ color: acento }}
      >
        {valor}
      </div>
      {dica && <div className="mt-0.5 text-[11px] text-muted-foreground">{dica}</div>}
    </div>
  );
}

/** Chip clicável de faixa de prazo ("Em rota, por prazo"). */
export function FaixaChip({
  rotulo,
  valor,
  tom,
  aoClicar,
}: {
  rotulo: string;
  valor: number;
  tom: "ruim" | "alerta" | "ok";
  aoClicar: () => void;
}) {
  const classe =
    tom === "ruim"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : tom === "alerta"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "border-border/70 bg-muted text-foreground";
  return (
    <button
      type="button"
      onClick={aoClicar}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition-colors hover:brightness-95",
        classe,
      )}
    >
      <span>{rotulo}</span>
      <span className="font-semibold tabular-nums">{formatarInteiro(valor)}</span>
    </button>
  );
}

/**
 * Grade de cards em linhas iguais: 8 cards = 4 + 4, 10 = 5 + 5, 9 = 5 + 4 (nenhum card sozinho
 * na linha). Conta só os filhos que de fato aparecem.
 */
export function GradeCards({ children }: { children: ReactNode }) {
  const n = Math.max(1, Children.toArray(children).length);
  const colunas = (max: number) => Math.ceil(n / Math.ceil(n / max));
  const estilo: CSSProperties & Record<"--cols-sm" | "--cols-lg", number> = {
    "--cols-sm": colunas(4),
    "--cols-lg": colunas(6),
  };
  return (
    <div
      className="grid grid-cols-2 gap-2 sm:[grid-template-columns:repeat(var(--cols-sm),minmax(0,1fr))] lg:[grid-template-columns:repeat(var(--cols-lg),minmax(0,1fr))]"
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
  return (
    <button
      type="button"
      onClick={aoClicar}
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
    >
      {ocultos ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      {ocultos
        ? `Mostrar ${quantos === 1 ? "card oculto" : `${quantos} cards ocultos`} (Baixado sem entrega${quantos > 1 ? ", Parado sem saída" : ""})`
        : "Ocultar Baixado sem entrega e Parado sem saída"}
    </button>
  );
}

/** Códigos que contam como prejuízo: os do filtro, senão o 13. */
export const codigosDoPrejuizo = (codigos: readonly number[] | undefined) =>
  codigos && codigos.length > 0 ? codigos : [13];

/** "código 13" ou "códigos 13, 69". */
export function textoDoPrejuizo(codigos: readonly number[] | undefined): string {
  const lista = codigosDoPrejuizo(codigos);
  return `${lista.length > 1 ? "códigos" : "código"} ${lista.join(", ")}`;
}

export function PrejuizoSubtitulo({ codigos }: { codigos?: readonly number[] | undefined }) {
  return (
    <span className="text-[10px] font-normal normal-case text-muted-foreground">
      {textoDoPrejuizo(codigos)}
    </span>
  );
}

/** Legenda quando há filtro de código ativo (prejuízo atribuído). */
export function AtribuicaoLegenda({ codigos }: { codigos?: readonly number[] | undefined }) {
  if (!codigos || codigos.length === 0) return null;
  return (
    <p className="rounded-md border border-border/70 bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
      Prejuízo atribuído ao(s) código(s) selecionado(s): {codigos.map((c) => `#${c}`).join(", ")} —
      conta apenas os CT-e cuja ocorrência penalizante é um desses códigos.
    </p>
  );
}

/** Select compacto do cabeçalho da lista; destaca a borda quando há filtro ativo. */
export function SelectLista<V extends string>({
  rotulo,
  valor,
  opcoes,
  aoMudar,
}: {
  rotulo: string;
  valor: V;
  opcoes: readonly { valor: V; rotulo: string }[];
  aoMudar: (v: V) => void;
}) {
  const ativo = valor !== opcoes[0]?.valor;
  return (
    <label className="inline-flex items-center gap-1.5">
      <span>{rotulo}:</span>
      <select
        value={valor}
        onChange={(e) => {
          const escolhida = opcoes.find((o) => o.valor === e.target.value);
          if (escolhida) aoMudar(escolhida.valor);
        }}
        className={cn(
          "h-7 rounded-md border bg-background px-2 text-[12px] text-foreground",
          ativo ? "border-[var(--brand)] ring-1 ring-[var(--brand)]/30" : "border-border/70",
        )}
      >
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Mensagem de carregando/vazio/erro dentro de um bloco. */
export function AvisoDoBloco({ children }: { children: ReactNode }) {
  return <div className="py-6 text-center text-[12px] text-muted-foreground">{children}</div>;
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
    <input
      value={texto}
      onChange={(e) => {
        setTexto(e.target.value);
      }}
      placeholder={placeholder}
      aria-label={placeholder.replace(/[.…]+$/, "")}
      className={cn(
        "h-7 rounded-md border border-border/70 bg-background px-2 text-[12px] outline-none focus:border-[var(--brand)]",
        className,
      )}
    />
  );
}
