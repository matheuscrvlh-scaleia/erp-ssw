/**
 * Seletores de filtro da Listagem, no visual de hoje.
 * TODO(kit-ui): trocar por FiltrosAvancados/FiltroPeriodo/FiltroMultiplo/FiltroTexto de
 * `@/componentes/comum` quando o kit chegar na main (o intervalo de datas ganha o calendário).
 * origem: FiltrosAvancados.tsx, PagadorPicker.tsx, BuscaDocumentoInput.tsx, FiltrandoPor.tsx
 */
import { type EntradaDe } from "@erp/shared/contrato";
import { type contratosFiltros, type PagadorOpcao } from "@erp/shared/contratos/filtros";
import { formatarData } from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import { CalendarIcon, Check, Info, Search, X } from "lucide-react";
import { forwardRef, type ReactNode, useEffect, useMemo, useState } from "react";

import { Button } from "@/componentes/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/componentes/ui/tooltip";
import { useSelecaoAdiada } from "@/hooks/use-selecao-adiada";
import { cn } from "@/lib/utils";

import { consultaFiliaisProprias, consultaOpcoesDeFiltro, consultaSugestoes } from "./api";
import { filtrarPagadores, siglasDoSeletor } from "./regras";

export type ContextoDosFiltros = EntradaDe<typeof contratosFiltros.opcoes>;

// ---------------------------------------------------------------- peças

export const GatilhoDeFiltro = forwardRef<
  HTMLButtonElement,
  { ativo: boolean; children: ReactNode; title?: string | undefined; className?: string }
>(function GatilhoDeFiltro({ ativo, children, className, ...resto }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      {...resto}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-card px-3 py-1 text-[12px] hover:bg-muted",
        ativo && "border-brand",
        className,
      )}
    >
      {children}
    </button>
  );
});

export function Contagem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 items-center rounded-md bg-secondary px-1.5 text-[10px] font-medium text-secondary-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** "x" dentro do gatilho: limpa sem abrir o seletor. */
export function LimparNoGatilho({ rotulo, aoLimpar }: { rotulo: string; aoLimpar: () => void }) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={rotulo}
      onClick={(e) => {
        e.stopPropagation();
        aoLimpar();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.stopPropagation();
          aoLimpar();
        }
      }}
      className="ml-1 rounded-sm p-0.5 hover:bg-muted-foreground/20"
    >
      <X className="h-3 w-3" />
    </span>
  );
}

export function ItemMarcavel({
  marcado,
  aoAlternar,
  children,
}: {
  marcado: boolean;
  aoAlternar: () => void;
  children: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={aoAlternar}
        aria-pressed={marcado}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-muted",
          marcado && "bg-status-good-bg",
        )}
      >
        <span
          className={cn(
            "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border border-border",
            marcado && "border-brand bg-brand text-white",
          )}
        >
          {marcado && <Check className="h-2.5 w-2.5" />}
        </span>
        {children}
      </button>
    </li>
  );
}

export function AvisoDaLista({ children, erro }: { children: ReactNode; erro?: boolean }) {
  return (
    <li
      className={cn(
        "px-3 py-3 text-center text-[11px] text-muted-foreground",
        erro && "text-status-bad",
      )}
    >
      {children}
    </li>
  );
}

export function InfoDica({ texto }: { texto: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help text-muted-foreground" aria-label={texto}>
          <Info className="h-3 w-3" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-[11px] leading-snug">
        {texto}
      </TooltipContent>
    </Tooltip>
  );
}

const CAMPO =
  "rounded-md border border-border/70 bg-background px-2 py-1 text-[12px] outline-none focus:border-brand";

// ---------------------------------------------------------------- busca por documento

/**
 * Busca por NF ou CT-e com espera de 400 ms (Enter aplica na hora). Aceita o número com ou sem
 * série e com ou sem dígito ("020642", "CAP020642-3").
 */
export function BuscaDocumento({
  valor,
  aoMudar,
  placeholder,
  className,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [local, setLocal] = useState(valor);
  const [valorVisto, setValorVisto] = useState(valor);
  if (valorVisto !== valor) {
    setValorVisto(valor);
    setLocal(valor);
  }

  useEffect(() => {
    const relogio = setTimeout(() => {
      if (local.trim() !== valor.trim()) aoMudar(local.trim());
    }, 400);
    return () => {
      clearTimeout(relogio);
    };
  }, [local, valor, aoMudar]);

  return (
    <div className={cn("relative w-[190px]", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
      <input
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") aoMudar(local.trim());
        }}
        placeholder={placeholder}
        aria-label={`Buscar por ${placeholder.replace(/\.+$/, "")}`}
        className={cn(CAMPO, "h-[26px] w-full pr-6 pl-7")}
      />
      {local.length > 0 && (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => {
            setLocal("");
            aoMudar("");
          }}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- período personalizado

export function IntervaloDeDatas({
  rotulo,
  de,
  ate,
  aoMudar,
}: {
  rotulo: string;
  de: string;
  ate: string;
  aoMudar: (de: string, ate: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [inicio, setInicio] = useState(de);
  const [fim, setFim] = useState(ate);
  const ativo = Boolean(de && ate);
  const valido = Boolean(inicio && fim && inicio <= fim);
  return (
    <Popover
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (v) {
          setInicio(de);
          setFim(ate);
        }
      }}
    >
      <PopoverTrigger asChild>
        <GatilhoDeFiltro ativo={ativo}>
          <CalendarIcon className="h-3 w-3" />
          {ativo
            ? `${rotulo} · ${formatarData(de)} a ${formatarData(ate)}`
            : `${rotulo} · Personalizado`}
          {ativo && (
            <LimparNoGatilho
              rotulo="Limpar período"
              aoLimpar={() => {
                aoMudar("", "");
              }}
            />
          )}
        </GatilhoDeFiltro>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2 p-3" align="start">
        <label className="block text-[11px] text-muted-foreground">
          De
          <input
            type="date"
            value={inicio}
            onChange={(e) => {
              setInicio(e.target.value);
            }}
            className={cn(CAMPO, "mt-1 w-full")}
          />
        </label>
        <label className="block text-[11px] text-muted-foreground">
          Até
          <input
            type="date"
            value={fim}
            onChange={(e) => {
              setFim(e.target.value);
            }}
            className={cn(CAMPO, "mt-1 w-full")}
          />
        </label>
        <Button
          size="sm"
          className="h-7 w-full text-[12px]"
          disabled={!valido}
          onClick={() => {
            aoMudar(inicio, fim);
            setAberto(false);
          }}
        >
          Aplicar
        </Button>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------- unidade responsável

export function SeletorDeFilial({
  selecionadas,
  aoMudar,
  contexto,
}: {
  selecionadas: readonly string[];
  aoMudar: (siglas: string[]) => void;
  contexto: ContextoDosFiltros;
}) {
  // A lista de unidades do período é pesada: só consulta com o seletor aberto.
  const [aberto, setAberto] = useState(false);
  const opcoes = useQuery({
    ...consultaOpcoesDeFiltro({ ...contexto, filiais: undefined }),
    enabled: aberto,
  });
  const proprias = useQuery({ ...consultaFiliaisProprias, enabled: aberto });
  const { selecionados, alterar, aplicar } = useSelecaoAdiada(selecionadas, aoMudar);
  const mudar = (siglas: string[]) => {
    alterar(siglas, siglas.length === 0);
  };
  const siglas = opcoes.data
    ? siglasDoSeletor(opcoes.data.filiais, selecionados, proprias.data ?? [])
    : null;
  return (
    <div className="inline-flex items-center gap-1">
      <Popover
        onOpenChange={(v) => {
          setAberto(v);
          if (!v) aplicar();
        }}
      >
        <PopoverTrigger asChild>
          <GatilhoDeFiltro ativo={selecionados.length > 0}>
            Unidade responsável
            {selecionados.length > 0 ? (
              <Contagem>{selecionados.length}</Contagem>
            ) : (
              <span className="text-muted-foreground">todas</span>
            )}
          </GatilhoDeFiltro>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-0" align="start">
          <CabecalhoDoSeletor
            titulo="Unidade responsável"
            aoLimpar={
              selecionados.length > 0
                ? () => {
                    mudar([]);
                  }
                : undefined
            }
          />
          <ul className="flex max-h-72 flex-col overflow-auto py-1">
            {siglas?.map((s) => (
              <ItemMarcavel
                key={s}
                marcado={selecionados.includes(s)}
                aoAlternar={() => {
                  mudar(
                    selecionados.includes(s)
                      ? selecionados.filter((x) => x !== s)
                      : [...selecionados, s],
                  );
                }}
              >
                <span className="font-mono">{s}</span>
              </ItemMarcavel>
            ))}
            {opcoes.isLoading && <AvisoDaLista>Carregando…</AvisoDaLista>}
            {opcoes.isError && (
              <AvisoDaLista erro>Não foi possível carregar as unidades.</AvisoDaLista>
            )}
            {siglas?.length === 0 && <AvisoDaLista>Sem unidades.</AvisoDaLista>}
          </ul>
        </PopoverContent>
      </Popover>
      <InfoDica texto="Unidade responsável pelo CT-e: usa a unidade de destino; na falta dela, a unidade atual; e por último a filial emissora." />
    </div>
  );
}

function CabecalhoDoSeletor({
  titulo,
  aoLimpar,
}: {
  titulo: string;
  aoLimpar?: (() => void) | undefined;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
      <span className="text-[12px] font-medium">{titulo}</span>
      {aoLimpar && (
        <button
          type="button"
          className="text-[11px] text-muted-foreground hover:text-foreground"
          onClick={aoLimpar}
        >
          limpar
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- parceiros (pagadores)

export function SeletorDePagador({
  rotulo,
  opcoes,
  selecionados: marcados,
  aoMudar,
}: {
  rotulo: string;
  opcoes: readonly PagadorOpcao[];
  selecionados: readonly string[];
  aoMudar: (ids: string[]) => void;
}) {
  const [termo, setTermo] = useState("");
  const { selecionados, alterar, aplicar } = useSelecaoAdiada(marcados, aoMudar);
  const mudar = (ids: string[]) => {
    alterar(ids, ids.length === 0);
  };
  const visiveis = useMemo(() => filtrarPagadores(opcoes, termo), [opcoes, termo]);
  return (
    <Popover
      onOpenChange={(v) => {
        if (!v) aplicar();
      }}
    >
      <PopoverTrigger asChild>
        <GatilhoDeFiltro ativo={selecionados.length > 0}>
          {rotulo}
          {selecionados.length > 0 ? (
            <Contagem>{selecionados.length}</Contagem>
          ) : (
            <span className="text-muted-foreground">todos</span>
          )}
        </GatilhoDeFiltro>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <CabecalhoDoSeletor
          titulo={rotulo}
          aoLimpar={
            selecionados.length > 0
              ? () => {
                  mudar([]);
                }
              : undefined
          }
        />
        <div className="border-b border-border/60 p-2">
          <input
            autoFocus
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value);
            }}
            placeholder="Buscar por nome ou CNPJ…"
            className={cn(CAMPO, "w-full")}
          />
        </div>
        <ul className="max-h-72 overflow-auto py-1">
          {visiveis.map((o) => (
            <ItemMarcavel
              key={o.id}
              marcado={selecionados.includes(o.id)}
              aoAlternar={() => {
                mudar(
                  selecionados.includes(o.id)
                    ? selecionados.filter((x) => x !== o.id)
                    : [...selecionados, o.id],
                );
              }}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{o.nome}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {o.cnpjFormatado}
                </span>
              </span>
            </ItemMarcavel>
          ))}
          {visiveis.length === 0 && <AvisoDaLista>Nenhum parceiro encontrado.</AvisoDaLista>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------- remetente / destino

/**
 * Texto com vários valores ("a|b"): marca sugestões do período ou adiciona o digitado (Enter).
 * Cada clique marca na hora; a tela só reconsulta após uma pausa ou ao fechar.
 */
export function SeletorDeTexto({
  rotulo,
  campo,
  valor,
  aoMudar,
  contexto,
}: {
  rotulo: string;
  campo: "remetente" | "cidade_destino";
  valor: string;
  aoMudar: (valor: string) => void;
  contexto: ContextoDosFiltros;
}) {
  const [aberto, setAberto] = useState(false);
  const valores = useMemo(
    () =>
      valor
        .split("|")
        .map((v) => v.trim())
        .filter(Boolean),
    [valor],
  );
  const { selecionados, alterar, aplicar } = useSelecaoAdiada(valores, (v) => {
    aoMudar(v.join("|"));
  });
  const [termo, setTermo] = useState("");
  const [termoAdiado, setTermoAdiado] = useState("");
  useEffect(() => {
    const relogio = setTimeout(() => {
      setTermoAdiado(termo);
    }, 250);
    return () => {
      clearTimeout(relogio);
    };
  }, [termo]);
  const sugestoes = useQuery({
    ...consultaSugestoes({ ...contexto, campo, q: termoAdiado }),
    enabled: aberto,
  });
  const alternar = (s: string) => {
    alterar(selecionados.includes(s) ? selecionados.filter((x) => x !== s) : [...selecionados, s]);
  };
  const adicionarDigitado = () => {
    const t = termo.trim();
    if (t && !selecionados.includes(t)) alterar([...selecionados, t], true);
    setTermo("");
  };
  const ativo = selecionados.length > 0;
  // O que já está marcado fica sempre visível, para poder desmarcar.
  const lista = [
    ...selecionados,
    ...(sugestoes.data ?? []).filter((s) => !selecionados.includes(s)),
  ];
  return (
    <Popover
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (!v) aplicar();
      }}
    >
      <PopoverTrigger asChild>
        <GatilhoDeFiltro ativo={ativo} title={ativo ? selecionados.join("\n") : undefined}>
          {rotulo}
          {ativo ? (
            <Contagem className="max-w-[140px] truncate">
              {selecionados.length === 1 ? selecionados[0] : `${selecionados.length} selecionados`}
            </Contagem>
          ) : (
            <span className="text-muted-foreground">qualquer</span>
          )}
          {ativo && (
            <LimparNoGatilho
              rotulo={`Limpar ${rotulo.toLowerCase()}`}
              aoLimpar={() => {
                alterar([], true);
              }}
            />
          )}
        </GatilhoDeFiltro>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
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
            placeholder={`Buscar ${rotulo.toLowerCase()}…`}
            className={cn(CAMPO, "w-full")}
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">
              {sugestoes.isFetching
                ? "buscando…"
                : "marque um ou mais · Enter adiciona o texto digitado"}
            </span>
            <button
              type="button"
              className="shrink-0 text-[10px] text-muted-foreground underline hover:text-foreground"
              onClick={() => {
                if (ativo) alterar([], true);
                else adicionarDigitado();
              }}
            >
              {ativo ? "limpar" : "aplicar"}
            </button>
          </div>
        </div>
        <ul className="max-h-72 overflow-auto py-1">
          {lista.map((s) => (
            <ItemMarcavel
              key={s}
              marcado={selecionados.includes(s)}
              aoAlternar={() => {
                alternar(s);
              }}
            >
              <span className="truncate">{s}</span>
            </ItemMarcavel>
          ))}
          {!sugestoes.isFetching && lista.length === 0 && (
            <AvisoDaLista>Sem sugestões.</AvisoDaLista>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------- faixa "Filtrando por"

export interface Etiqueta {
  rotulo: string;
  valor: string;
  /** Texto completo para o title (quando `valor` foi resumido). */
  completo?: string;
  limpar: () => void;
}

/**
 * Com qualquer filtro ligado, mostra em destaque o que está recortando os números; cada "x" tira
 * só aquele filtro. Período e base de data não entram (já estão nos botões).
 */
export function FiltrandoPor({ etiquetas }: { etiquetas: readonly Etiqueta[] }) {
  const ativas = etiquetas.filter((e) => e.valor !== "");
  if (ativas.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-brand/40 bg-brand/5 px-3 py-2.5">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Filtrando por
      </span>
      {ativas.map((e) => (
        <span
          key={e.rotulo}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-brand/60 bg-card py-1 pr-1.5 pl-3 text-[15px]"
        >
          <span className="shrink-0 text-muted-foreground">{e.rotulo}:</span>
          <span className="truncate font-semibold text-foreground" title={e.completo ?? e.valor}>
            {e.valor}
          </span>
          <button
            type="button"
            onClick={e.limpar}
            title={`Tirar o filtro de ${e.rotulo.toLowerCase()}`}
            aria-label={`Tirar o filtro de ${e.rotulo.toLowerCase()}`}
            className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
    </div>
  );
}

export function LimparFiltros({ visivel, aoLimpar }: { visivel: boolean; aoLimpar: () => void }) {
  if (!visivel) return null;
  return (
    <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={aoLimpar}>
      Limpar filtros
    </Button>
  );
}
