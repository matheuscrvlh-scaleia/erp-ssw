import { type TipoRecorte, TIPOS_RECORTE } from "@erp/shared/contratos/listagem";

import { GatilhoFiltro } from "@/componentes/comum/GatilhoFiltro";
import { Badge } from "@/componentes/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";
import { useSelecaoAdiada } from "@/hooks/use-selecao-adiada";

import { alternarRecorte } from "../regras";
import { ItemMarcavel } from "./ItemMarcavel";

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
        <GatilhoFiltro
          ativo={selecionados.length > 1 || unico !== "emitidos"}
          rotulo="Recorte"
          className="max-w-[24rem]"
          title={selecionados.map((t) => rotulos[t]).join(" + ")}
        >
          <span className="text-muted-foreground">Recorte</span>{" "}
          <span className="truncate font-semibold">{resumo}</span>
          {selecionados.length > 1 && (
            <Badge
              variant="secondary"
              className="h-5 border-transparent bg-brand-suave px-2 text-[11.5px] text-brand"
            >
              {selecionados.length}
            </Badge>
          )}
        </GatilhoFiltro>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-2rem)] p-0" align="end">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 text-[12.5px] text-muted-foreground">
          <span>Marque um ou mais recortes</span>
          <button
            type="button"
            className="font-medium text-brand hover:underline disabled:opacity-40"
            disabled={selecionados.length === 1 && unico === "emitidos"}
            onClick={() => {
              alterar(["emitidos"], true);
            }}
          >
            limpar
          </button>
        </div>
        <ul className="rolagem-fina max-h-96 overflow-auto p-1">
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
