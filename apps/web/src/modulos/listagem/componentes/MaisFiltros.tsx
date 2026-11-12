import { Filter } from "lucide-react";

import { GatilhoFiltro } from "@/componentes/comum/GatilhoFiltro";
import { Badge } from "@/componentes/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";

import { type BuscaDaLista } from "../busca";

function numeroOuNulo(texto: string): number | null {
  if (texto.trim() === "") return null;
  const n = Number(texto);
  return Number.isFinite(n) ? n : null;
}

/** Cidade, peso e atraso; cada campo aplica ao sair dele. */
export function MaisFiltros({
  busca,
  ativo,
  aoMudar,
}: {
  busca: BuscaDaLista;
  ativo: boolean;
  aoMudar: (mudanca: Partial<BuscaDaLista>) => void;
}) {
  const campo =
    "h-8 w-full rounded-lg border border-input bg-card px-2.5 text-[13px] outline-none focus:border-ring";
  const inteiroOuNulo = (texto: string) => {
    const n = numeroOuNulo(texto);
    return n === null ? null : Math.trunc(n);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <GatilhoFiltro ativo={ativo} rotulo="Mais filtros">
          <Filter className="h-4 w-4 text-muted-foreground" aria-hidden />
          Mais filtros
          {ativo && (
            <Badge
              variant="secondary"
              className="h-5 border-transparent bg-brand-suave px-2 text-[11.5px] text-brand"
            >
              ativo
            </Badge>
          )}
        </GatilhoFiltro>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 p-3">
        <label className="block text-[12.5px] font-medium text-muted-foreground">
          Cidade destino contém
          <input
            defaultValue={busca.cidade}
            onBlur={(e) => {
              aoMudar({ cidade: e.target.value.trim() });
            }}
            placeholder="Ex.: Manaus"
            className={`mt-1 ${campo}`}
          />
        </label>
        <div>
          <span className="text-[12.5px] font-medium text-muted-foreground">Peso (kg)</span>
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              aria-label="Peso mínimo"
              defaultValue={busca.peso_min ?? ""}
              onBlur={(e) => {
                aoMudar({ peso_min: numeroOuNulo(e.target.value) });
              }}
              placeholder="mín."
              className={campo}
            />
            <input
              type="number"
              aria-label="Peso máximo"
              defaultValue={busca.peso_max ?? ""}
              onBlur={(e) => {
                aoMudar({ peso_max: numeroOuNulo(e.target.value) });
              }}
              placeholder="máx."
              className={campo}
            />
          </div>
        </div>
        <div>
          <span className="text-[12.5px] font-medium text-muted-foreground">Atraso (dias)</span>
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              aria-label="Atraso mínimo"
              defaultValue={busca.atraso_min ?? ""}
              onBlur={(e) => {
                aoMudar({ atraso_min: inteiroOuNulo(e.target.value) });
              }}
              placeholder="mín."
              className={campo}
            />
            <input
              type="number"
              aria-label="Atraso máximo"
              defaultValue={busca.atraso_max ?? ""}
              onBlur={(e) => {
                aoMudar({ atraso_max: inteiroOuNulo(e.target.value) });
              }}
              placeholder="máx."
              className={campo}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
