import { type TipoRecorte, TIPOS_RECORTE } from "@erp/shared/contratos/listagem";

import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";
import { useSelecaoAdiada } from "@/hooks/use-selecao-adiada";
import { cn } from "@/lib/utils";
import { Contagem, ItemMarcavel } from "@/modulos/filtros/componentes";

/**
 * Próxima seleção do seletor Recorte: "CT-e emitidos" é o recorte sem condição — marcá-lo
 * desmarca os outros, e desmarcar tudo volta para ele. Ordem sempre a da lista.
 */
export function alternarRecorte(
  marcados: readonly TipoRecorte[],
  recorte: TipoRecorte,
): TipoRecorte[] {
  if (recorte === "emitidos") return ["emitidos"];
  const proximos = new Set(marcados);
  proximos.delete("emitidos");
  if (proximos.has(recorte)) proximos.delete(recorte);
  else proximos.add(recorte);
  const lista = TIPOS_RECORTE.filter((t) => proximos.has(t));
  return lista.length > 0 ? lista : ["emitidos"];
}

/**
 * Seletor "Recorte", de múltipla escolha: o CT-e entra se cair em qualquer recorte marcado.
 * origem: RecortePicker.tsx (sistema atual)
 */
export function SeletorDeRecorte({
  rotulos,
  selecionados: marcados,
  aoMudar,
}: {
  rotulos: Readonly<Record<TipoRecorte, string>>;
  selecionados: readonly TipoRecorte[];
  aoMudar: (recortes: TipoRecorte[]) => void;
}) {
  const { selecionados, alterar, aplicar } = useSelecaoAdiada(marcados, aoMudar);
  const [unico] = selecionados;
  const resumo =
    selecionados.length === 1 && unico ? rotulos[unico] : `${selecionados.length} recortes`;
  return (
    <Popover
      onOpenChange={(v) => {
        if (!v) aplicar();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex max-w-[22rem] items-center gap-1.5 rounded-md border border-border/70 bg-card px-2 py-1 text-[12px] hover:bg-muted",
            selecionados.length > 1 && "border-brand",
          )}
          title={selecionados.map((t) => rotulos[t]).join(" + ")}
        >
          <span className="truncate">{resumo}</span>
          {selecionados.length > 1 && <Contagem>{selecionados.length}</Contagem>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-2rem)] p-0" align="end">
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
          <span>Marque um ou mais recortes</span>
          <button
            type="button"
            className="underline disabled:opacity-40"
            disabled={selecionados.length === 1 && unico === "emitidos"}
            onClick={() => {
              alterar(["emitidos"], true);
            }}
          >
            limpar
          </button>
        </div>
        <ul className="max-h-96 overflow-auto py-1">
          {TIPOS_RECORTE.map((t) => (
            <ItemMarcavel
              key={t}
              marcado={selecionados.includes(t)}
              aoAlternar={() => {
                alterar(alternarRecorte(selecionados, t));
              }}
            >
              <span className="flex-1">{rotulos[t]}</span>
            </ItemMarcavel>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
