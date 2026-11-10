import { juntarFiltroTexto, lerFiltroTexto } from "@erp/shared/filtro-texto";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/componentes/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";
import { useSelecaoAdiada } from "@/hooks/use-selecao-adiada";
import { cn } from "@/lib/utils";

import { GatilhoFiltro } from "./GatilhoFiltro";

const ESPERA_DIGITACAO_MS = 250;

interface SugestoesFiltroTexto {
  /** Prefixo da chave do React Query (inclua os filtros que mudam as sugestões). */
  chave: readonly unknown[];
  buscar: (termo: string) => Promise<readonly string[]>;
}

interface FiltroTextoProps {
  rotulo: string;
  /** Valores separados por "|" (ex.: "Natura|Avon"): é o formato da URL e da API. */
  valor: string;
  aoMudar: (valor: string) => void;
  /** Sugestões do servidor enquanto digita (só com o seletor aberto). */
  sugestoes?: SugestoesFiltroTexto | undefined;
  placeholder?: string | undefined;
  /** Padrão: "qualquer". */
  textoVazio?: string | undefined;
  larguraClasse?: string | undefined;
}

/**
 * Filtro de texto com vários valores (remetente, destino): marca sugestões ou digita e Enter.
 * Viaja como um texto só, "a|b"; a consulta aceita o registro que contiver qualquer um.
 * origem: TextoAutocomplete em FiltrosAvancados.tsx (sistema atual)
 */
export function FiltroTexto({
  rotulo,
  valor,
  aoMudar,
  sugestoes,
  placeholder,
  textoVazio = "qualquer",
  larguraClasse = "w-72",
}: FiltroTextoProps) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [termoAdiado, setTermoAdiado] = useState("");
  const valores = useMemo(() => lerFiltroTexto(valor), [valor]);
  const { selecionados, alterar, aplicar } = useSelecaoAdiada(valores, (v) => {
    aoMudar(juntarFiltroTexto(v));
  });

  useEffect(() => {
    const espera = setTimeout(() => {
      setTermoAdiado(termo);
    }, ESPERA_DIGITACAO_MS);
    return () => {
      clearTimeout(espera);
    };
  }, [termo]);

  const consulta = useQuery({
    queryKey: [...(sugestoes?.chave ?? ["filtro-texto"]), termoAdiado],
    queryFn: () => sugestoes?.buscar(termoAdiado) ?? Promise.resolve([]),
    enabled: aberto && sugestoes !== undefined,
    staleTime: 60_000,
  });

  const ativo = selecionados.length > 0;
  const lista = [
    ...selecionados,
    ...(consulta.data ?? []).filter((s) => !selecionados.includes(s)),
  ];

  const alternar = (s: string) => {
    alterar(selecionados.includes(s) ? selecionados.filter((x) => x !== s) : [...selecionados, s]);
  };
  const adicionarDigitado = () => {
    const limpo = termo.trim();
    if (limpo && !selecionados.includes(limpo)) alterar([...selecionados, limpo], true);
    setTermo("");
  };

  return (
    <Popover
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (!v) aplicar();
      }}
    >
      <PopoverTrigger asChild>
        <GatilhoFiltro
          ativo={ativo}
          rotulo={rotulo}
          aoLimpar={() => {
            alterar([], true);
          }}
          title={ativo ? selecionados.join("\n") : undefined}
        >
          {rotulo}{" "}
          {ativo ? (
            <Badge variant="secondary" className="h-4 max-w-[140px] truncate px-1.5 text-[10px]">
              {selecionados.length === 1
                ? selecionados[0]
                : `${String(selecionados.length)} selecionados`}
            </Badge>
          ) : (
            <span className="text-muted-foreground">{textoVazio}</span>
          )}
        </GatilhoFiltro>
      </PopoverTrigger>
      <PopoverContent className={cn("p-0", larguraClasse)} align="start">
        <div className="border-b border-border/60 p-2">
          <input
            autoFocus
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") adicionarDigitado();
            }}
            placeholder={placeholder ?? `Buscar ${rotulo.toLowerCase()}…`}
            aria-label={`Buscar ${rotulo.toLowerCase()}`}
            className="w-full rounded-md border border-border/70 bg-background px-2 py-1 text-[12px] outline-none focus:border-[var(--brand)]"
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">
              {consulta.isFetching
                ? "buscando…"
                : "marque um ou mais · Enter adiciona o texto digitado"}
            </span>
            {ativo ? (
              <button
                type="button"
                className="shrink-0 text-[10px] text-muted-foreground underline hover:text-foreground"
                onClick={() => {
                  alterar([], true);
                }}
              >
                limpar
              </button>
            ) : (
              <button
                type="button"
                className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={adicionarDigitado}
              >
                aplicar
              </button>
            )}
          </div>
        </div>
        <ul className="max-h-72 overflow-auto py-1" aria-label={rotulo}>
          {lista.map((s) => {
            const marcado = selecionados.includes(s);
            return (
              <li key={s}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={marcado}
                  onClick={() => {
                    alternar(s);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-muted",
                    marcado && "bg-[var(--status-good-bg)]",
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
                  <span className="truncate">{s}</span>
                </button>
              </li>
            );
          })}
          {!consulta.isFetching && lista.length === 0 && (
            <li className="px-3 py-3 text-center text-[11px] text-muted-foreground">
              Sem sugestões.
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
