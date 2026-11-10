import { Check } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Badge } from "@/componentes/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";
import { useSelecaoAdiada } from "@/hooks/use-selecao-adiada";
import { cn } from "@/lib/utils";

import { GatilhoFiltro } from "./GatilhoFiltro";

export interface OpcaoFiltro {
  valor: string;
  /** Texto mostrado; padrão: o próprio valor. */
  rotulo?: string | undefined;
  /** Complemento à direita (contagem, selo "penaliza"). */
  detalhe?: ReactNode;
  /** Sem dados no período: aparece apagada, no fim. */
  apagada?: boolean | undefined;
}

/** Busca sem diferenciar maiúscula nem acento ("sao" acha "São Paulo"). */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Marcadas primeiro (mesmo fora da lista, para poder desmarcar), depois as que casam com a busca. */
export function opcoesVisiveis(
  opcoes: readonly OpcaoFiltro[],
  selecionados: readonly string[],
  termo: string,
): OpcaoFiltro[] {
  const busca = normalizarBusca(termo.trim());
  const casa = (o: OpcaoFiltro) =>
    !busca || normalizarBusca(`${o.valor} ${o.rotulo ?? ""}`).includes(busca);
  const porValor = new Map(opcoes.map((o) => [o.valor, o]));
  const marcadas = selecionados.map((v) => porValor.get(v) ?? { valor: v });
  const resto = opcoes.filter((o) => !selecionados.includes(o.valor) && casa(o));
  return [...marcadas, ...resto.filter((o) => !o.apagada), ...resto.filter((o) => o.apagada)];
}

export interface FiltroMultiploProps {
  rotulo: string;
  /** `undefined` enquanto carrega. */
  opcoes: readonly OpcaoFiltro[] | undefined;
  selecionados: readonly string[];
  aoMudar: (valores: string[]) => void;
  /** Texto quando nada está marcado. Padrão: "todas". */
  textoVazio?: string | undefined;
  /** Caixa de busca; padrão: ligada com mais de 8 opções. */
  busca?: boolean | undefined;
  /** Avisa abrir/fechar: a tela pode buscar as opções só com o seletor aberto. */
  aoAbrir?: ((aberto: boolean) => void) | undefined;
  /** Valores em fonte monoespaçada (siglas, placas). */
  monoespacado?: boolean | undefined;
  /** Texto do selo; padrão: o rótulo da única marcada ou "N selecionados". */
  resumo?: ((selecionados: readonly string[]) => string) | undefined;
  larguraClasse?: string | undefined;
}

/**
 * Seletor de vários valores com busca (unidade, parceiro, código, tipo de documento). Cada
 * clique marca na hora; a tela só reconsulta após uma pausa ou ao fechar.
 * origem: FilialPicker / CodigoOcorrenciaPicker em FiltrosAvancados.tsx (sistema atual)
 */
export function FiltroMultiplo({
  rotulo,
  opcoes,
  selecionados: selecionadosProp,
  aoMudar,
  textoVazio = "todas",
  busca,
  aoAbrir,
  monoespacado,
  resumo,
  larguraClasse = "w-64",
}: FiltroMultiploProps) {
  const [termo, setTermo] = useState("");
  const { selecionados, alterar, aplicar } = useSelecaoAdiada(selecionadosProp, aoMudar);
  const ativo = selecionados.length > 0;
  const comBusca = busca ?? (opcoes?.length ?? 0) > 8;
  const lista = opcoesVisiveis(opcoes ?? [], selecionados, termo);
  const rotuloDe = (v: string) => opcoes?.find((o) => o.valor === v)?.rotulo ?? v;
  const textoSelo = resumo
    ? resumo(selecionados)
    : selecionados.length === 1
      ? rotuloDe(selecionados[0] ?? "")
      : `${String(selecionados.length)} selecionados`;

  const alternar = (valor: string) => {
    alterar(
      selecionados.includes(valor)
        ? selecionados.filter((v) => v !== valor)
        : [...selecionados, valor],
    );
  };

  return (
    <Popover
      onOpenChange={(aberto) => {
        aoAbrir?.(aberto);
        if (!aberto) {
          aplicar();
          setTermo("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <GatilhoFiltro
          ativo={ativo}
          rotulo={rotulo}
          aoLimpar={() => {
            alterar([], true);
          }}
          title={ativo ? selecionados.map(rotuloDe).join("\n") : undefined}
        >
          {rotulo}
          {/* Espaço para o nome acessível ("Unidade todas"); no flex ele não aparece. */}{" "}
          {ativo ? (
            <Badge variant="secondary" className="h-4 max-w-[140px] truncate px-1.5 text-[10px]">
              {textoSelo}
            </Badge>
          ) : (
            <span className="text-muted-foreground">{textoVazio}</span>
          )}
        </GatilhoFiltro>
      </PopoverTrigger>
      <PopoverContent className={cn("p-0", larguraClasse)} align="start">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 p-2">
          {comBusca ? (
            <input
              autoFocus
              value={termo}
              onChange={(e) => {
                setTermo(e.target.value);
              }}
              placeholder={`Buscar ${rotulo.toLowerCase()}…`}
              aria-label={`Buscar ${rotulo.toLowerCase()}`}
              className="w-full rounded-md border border-border/70 bg-background px-2 py-1 text-[12px] outline-none focus:border-[var(--brand)]"
            />
          ) : (
            <span className="px-1 text-[12px] font-medium">{rotulo}</span>
          )}
          {ativo && (
            <button
              type="button"
              className="shrink-0 text-[11px] text-muted-foreground underline hover:text-foreground"
              onClick={() => {
                alterar([], true);
              }}
            >
              limpar
            </button>
          )}
        </div>
        <ul className="max-h-72 overflow-auto py-1" aria-label={rotulo}>
          {lista.map((o) => {
            const marcado = selecionados.includes(o.valor);
            return (
              <li key={o.valor}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={marcado}
                  onClick={() => {
                    alternar(o.valor);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-muted",
                    marcado && "bg-[var(--status-good-bg)]",
                    o.apagada && !marcado && "opacity-50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border border-border",
                      marcado && "border-[var(--brand)] bg-[var(--brand)] text-white",
                    )}
                    aria-hidden
                  >
                    {marcado && <Check className="h-2.5 w-2.5" />}
                  </span>
                  <span className={cn("flex-1 truncate", monoespacado && "font-mono")}>
                    {o.rotulo ?? o.valor}
                  </span>
                  {o.detalhe}
                </button>
              </li>
            );
          })}
          {!opcoes && (
            <li className="px-3 py-3 text-center text-[11px] text-muted-foreground">Carregando…</li>
          )}
          {opcoes && lista.length === 0 && (
            <li className="px-3 py-3 text-center text-[11px] text-muted-foreground">
              Nenhuma opção.
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
