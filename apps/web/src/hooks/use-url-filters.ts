import { type z } from "@erp/shared/zod";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

import { type EsquemaFiltros, filtrosAtivos, lerFiltros, semPadroes } from "./url-filters";

export { campoFiltro, temFiltro } from "./url-filters";

/**
 * Filtros da tela guardados na URL (link compartilhável, F5 e "voltar" do navegador mantêm o
 * recorte). O esquema zod define campos e padrões — use `campoFiltro` para cada campo.
 *
 * ```ts
 * const esquema = z.object({ periodo: campoFiltro.opcao(PERIODOS, "mes"), unidades: campoFiltro.lista() });
 * const { filtros, definir, limpar, ativos } = useFiltrosNaUrl(esquema);
 * definir({ unidades: ["CAS"] });
 * ```
 * Declare o esquema fora do componente (identidade estável).
 */
export function useFiltrosNaUrl<S extends EsquemaFiltros>(esquema: S) {
  const bruto = useSearch({ strict: false });
  const navigate = useNavigate();
  const padrao = useMemo(() => lerFiltros(esquema, {}), [esquema]);
  const filtros = useMemo(() => lerFiltros(esquema, bruto), [esquema, bruto]);

  /** Muda um ou mais filtros (vira uma entrada no histórico, como hoje). */
  const definir = useCallback(
    (mudanca: Partial<z.output<S>>) => {
      void navigate({
        to: ".",
        search: (anterior: Record<string, unknown>) =>
          semPadroes({ ...anterior, ...mudanca }, padrao),
      });
    },
    [navigate, padrao],
  );

  /** Volta todos os filtros do esquema ao padrão, exceto os de `manter` (ex.: o período). */
  const limpar = useCallback(
    (manter: readonly (keyof z.output<S> & string)[] = []) => {
      void navigate({
        to: ".",
        search: (anterior: Record<string, unknown>) =>
          Object.fromEntries(
            Object.entries(anterior).filter(
              ([chave]) => !(chave in esquema.shape) || manter.includes(chave),
            ),
          ),
      });
    },
    [navigate, esquema],
  );

  const ativos = useMemo(() => filtrosAtivos(filtros, padrao), [filtros, padrao]);
  return { filtros, definir, limpar, ativos };
}
