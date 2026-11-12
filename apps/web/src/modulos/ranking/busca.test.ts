import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { type EtiquetaFiltro } from "@/componentes/comum/FiltrosAvancados";

import { etiquetasDosFiltros, useFiltrosDoRanking } from "./busca";

describe("filtros do ranking", () => {
  it("começa em 30 dias por emissão, sem filtro ativo; limpar volta ao padrão", () => {
    const { result } = renderHook(() => useFiltrosDoRanking());
    expect(result.current).toMatchObject({ rapido: "30d", base: "emissao", ativos: false });
    act(() => {
      result.current.setBase("prevista");
      result.current.setDestino("SP");
    });
    expect(result.current.ativos).toBe(true);
    act(() => {
      result.current.limpar();
    });
    expect(result.current).toMatchObject({ base: "emissao", destino: "", ativos: false });
  });

  it("filtra pela união dos CNPJs marcados nos dois seletores de parceiro", () => {
    const { result } = renderHook(() => useFiltrosDoRanking());
    act(() => {
      result.current.setParceirosCnpj(["222", "111"]);
      result.current.setParceirosAgrupados(["111", "333"]);
    });
    expect(result.current.parceiros).toEqual(["111", "222", "333"]);
  });

  it("uma etiqueta por filtro marcado, e cada uma limpa o seu", () => {
    const { result } = renderHook(() => useFiltrosDoRanking());
    act(() => {
      result.current.setFiliais(["CAP", "SOR"]);
      result.current.setTipos(["CTE"]);
    });
    const etiquetas = etiquetasDosFiltros(result.current, {
      parceiros: ["Zeta Ltda"],
      agrupados: [],
      tipos: "CTE",
    }).filter((e): e is EtiquetaFiltro => Boolean(e));
    expect(etiquetas.map((e) => [e.rotulo, e.valor])).toEqual([
      ["Parceiro", "Zeta Ltda"],
      ["Unidade responsável", "CAP, SOR"],
      ["Tipo", "CTE"],
    ]);
    act(() => {
      etiquetas[1]?.limpar?.();
    });
    expect(result.current.filiais).toEqual([]);
  });
});
