/*
 * Seletores mínimos da barra de filtros.
 * TODO(kit-ui): trocar por FiltrosAvancados/FiltroPeriodo/FiltroMultiplo/FiltroTexto do kit
 * (apps/web/src/components/comum) quando chegarem à main.
 */
import { Info, Search, X } from "lucide-react";
import { useState } from "react";

import { Input } from "@/componentes/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";

export interface Opcao {
  id: string;
  rotulo: string;
  sub?: string;
}

const GATILHO =
  "inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-card px-3 py-1 text-[12px] hover:bg-muted";

function Contagem({ n }: { n: number }) {
  return n > 0 ? (
    <span className="inline-flex h-4 items-center rounded-full bg-secondary px-1.5 text-[10px] font-medium text-secondary-foreground">
      {n}
    </span>
  ) : (
    <span className="text-muted-foreground">todos</span>
  );
}

export function Dica({ texto }: { texto: string }) {
  return (
    <span className="inline-flex cursor-help text-muted-foreground" title={texto}>
      <Info className="h-3.5 w-3.5" />
    </span>
  );
}

/**
 * Seleção múltipla: marca na hora e só aplica ao fechar (ou ao limpar), para não reconsultar a
 * tela a cada clique.
 */
export function SeletorMultiplo({
  rotulo,
  opcoes,
  selecionados,
  onChange,
  onAbrir,
  carregando = false,
  dica,
}: {
  rotulo: string;
  opcoes: readonly Opcao[];
  selecionados: readonly string[];
  onChange: (ids: string[]) => void;
  onAbrir?: (aberto: boolean) => void;
  carregando?: boolean;
  dica?: string;
}) {
  const [rascunho, setRascunho] = useState<string[] | null>(null);
  const marcados = rascunho ?? [...selecionados];
  const aplicar = (ids: string[]) => {
    setRascunho(null);
    if (ids.join("|") !== selecionados.join("|")) onChange(ids);
  };
  return (
    <span className="inline-flex items-center gap-1">
      <Popover
        onOpenChange={(aberto) => {
          onAbrir?.(aberto);
          if (!aberto && rascunho) aplicar(rascunho);
        }}
      >
        <PopoverTrigger asChild>
          <button className={GATILHO}>
            {rotulo}
            <Contagem n={selecionados.length} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <span className="text-[12px] font-medium">{rotulo}</span>
            {marcados.length > 0 && (
              <button
                className="text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => { aplicar([]); }}
              >
                limpar
              </button>
            )}
          </div>
          <ul className="max-h-72 overflow-auto py-1">
            {opcoes.map((o) => (
              <li key={o.id}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-muted">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-[var(--brand)]"
                    checked={marcados.includes(o.id)}
                    onChange={(e) => { setRascunho(
                        e.target.checked ? [...marcados, o.id] : marcados.filter((x) => x !== o.id),
                      ); }
                    }
                  />
                  <span className="flex-1">{o.rotulo}</span>
                  {o.sub && <span className="text-muted-foreground">{o.sub}</span>}
                </label>
              </li>
            ))}
            {carregando && (
              <li className="px-3 py-2 text-[12px] text-muted-foreground">Carregando…</li>
            )}
            {!carregando && opcoes.length === 0 && (
              <li className="px-3 py-2 text-[12px] text-muted-foreground">Sem opções.</li>
            )}
          </ul>
        </PopoverContent>
      </Popover>
      {dica ? <Dica texto={dica} /> : null}
    </span>
  );
}

/** Texto com vários valores separados por "|" (Remetente, Destino), com sugestões. */
export function FiltroTexto({
  rotulo,
  valor,
  onChange,
  sugestoes,
  onBusca,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  sugestoes: readonly string[];
  onBusca: (q: string) => void;
}) {
  const [texto, setTexto] = useState(valor);
  const ultimo = texto.split("|").at(-1)?.trim() ?? "";
  const escolher = (s: string) => {
    const partes = texto
      .split("|")
      .slice(0, -1)
      .map((p) => p.trim());
    setTexto([...partes, s].join(" | "));
  };
  return (
    <Popover
      onOpenChange={(aberto) => {
        if (aberto) {
          setTexto(valor);
          onBusca(valor.split("|").at(-1)?.trim() ?? "");
        } else if (texto.trim() !== valor) onChange(texto.trim());
      }}
    >
      <PopoverTrigger asChild>
        <button className={GATILHO}>
          {rotulo}
          {valor ? (
            <span className="max-w-[140px] truncate font-medium">{valor}</span>
          ) : (
            <span className="text-muted-foreground">todos</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2">
        <Input
          autoFocus
          value={texto}
          placeholder="Digite; separe vários com |"
          className="h-8 text-[12px]"
          onChange={(e) => {
            setTexto(e.target.value);
            onBusca(e.target.value.split("|").at(-1)?.trim() ?? "");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onChange(texto.trim());
          }}
        />
        <ul className="mt-1 max-h-60 overflow-auto">
          {sugestoes
            .filter((s) => s.toLowerCase() !== ultimo.toLowerCase())
            .map((s) => (
              <li key={s}>
                <button
                  className="w-full truncate rounded px-2 py-1 text-left text-[12px] hover:bg-muted"
                  onClick={() => { escolher(s); }}
                >
                  {s}
                </button>
              </li>
            ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

const diaBr = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");

/** Intervalo livre de datas na base escolhida. */
export function FiltroDatas({
  rotulo,
  de,
  ate,
  onChange,
}: {
  rotulo: string;
  de: string;
  ate: string;
  onChange: (de: string, ate: string) => void;
}) {
  const [inicio, setInicio] = useState(de);
  const [fim, setFim] = useState(ate);
  return (
    <Popover
      onOpenChange={(aberto) => {
        if (!aberto) return;
        setInicio(de);
        setFim(ate);
      }}
    >
      <PopoverTrigger asChild>
        <button className={GATILHO}>
          {rotulo}
          {de && ate ? (
            <span className="font-medium">
              {diaBr(de)} → {diaBr(ate)}
            </span>
          ) : (
            <span className="text-muted-foreground">intervalo</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2 p-3 text-[12px]">
        <label className="block">
          De
          <Input type="date" value={inicio} onChange={(e) => { setInicio(e.target.value); }} />
        </label>
        <label className="block">
          Até
          <Input type="date" value={fim} onChange={(e) => { setFim(e.target.value); }} />
        </label>
        <div className="flex justify-between">
          <button
            className="text-muted-foreground hover:text-foreground"
            onClick={() => { onChange("", ""); }}
          >
            limpar
          </button>
          <button
            className="rounded-md bg-[var(--brand)] px-3 py-1 text-white disabled:opacity-50"
            disabled={!inicio || !fim}
            onClick={() => { onChange(inicio, fim); }}
          >
            Aplicar
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Campo de busca de documento: Enter abre a lista com o número digitado. */
export function BuscaDocumento({
  placeholder,
  onBuscar,
}: {
  placeholder: string;
  onBuscar: (v: string) => void;
}) {
  const [valor, setValor] = useState("");
  return (
    <span className="relative inline-flex w-[150px] items-center">
      <Search className="absolute left-2 h-3 w-3 text-muted-foreground" />
      <Input
        value={valor}
        placeholder={placeholder}
        className="h-7 pl-6 text-[12px]"
        onChange={(e) => { setValor(e.target.value); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && valor.trim()) onBuscar(valor.trim());
        }}
      />
    </span>
  );
}

export interface Etiqueta {
  rotulo: string;
  valor: string;
  limpar: () => void;
}

/** Resumo de nomes: até 2 e "+N". */
export function resumirNomes(nomes: readonly string[]): string {
  if (nomes.length <= 2) return nomes.join(", ");
  return `${nomes.slice(0, 2).join(", ")} +${nomes.length - 2}`;
}

/** Faixa "Filtrando por": um item por filtro ligado, cada um com o seu "x". */
export function FiltrandoPor({ etiquetas }: { etiquetas: readonly Etiqueta[] }) {
  if (etiquetas.length === 0) return null;
  return (
    <div className="-mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="text-muted-foreground">Filtrando por:</span>
      {etiquetas.map((e) => (
        <span
          key={e.rotulo}
          className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card px-2 py-0.5"
        >
          <span className="text-muted-foreground">{e.rotulo}:</span>
          <span className="font-medium">{e.valor}</span>
          <button
            onClick={e.limpar}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Tirar o filtro ${e.rotulo}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
