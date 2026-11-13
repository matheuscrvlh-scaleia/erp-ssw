import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ATRASO_FILTRO_MS, useSelecaoAdiada } from "@/hooks/use-deferred-selection";

import { FiltrandoPor, resumirNomes } from "./AdvancedFilters";
import { FiltroMultiplo, opcoesVisiveis } from "./MultiFilter";
import { resolverPeriodo } from "./period";

afterEach(cleanup);

describe("resolverPeriodo (hoje = dia de Brasília)", () => {
  const hoje = "2026-03-10";
  it("atalhos", () => {
    expect(resolverPeriodo("hoje", "", "", hoje)).toEqual({ inicio: hoje, fim: hoje });
    expect(resolverPeriodo("7d", "", "", hoje)).toEqual({ inicio: "2026-03-04", fim: hoje });
    expect(resolverPeriodo("30d", "", "", hoje)).toEqual({ inicio: "2026-02-09", fim: hoje });
    expect(resolverPeriodo("mes", "", "", hoje)).toEqual({ inicio: "2026-03-01", fim: hoje });
    expect(resolverPeriodo("mes_anterior", "", "", hoje)).toEqual({
      inicio: "2026-02-01",
      fim: "2026-02-28",
    });
  });

  it("mês anterior em janeiro volta para dezembro do ano anterior", () => {
    expect(resolverPeriodo("mes_anterior", "", "", "2026-01-15")).toEqual({
      inicio: "2025-12-01",
      fim: "2025-12-31",
    });
  });

  it("personalizado sem as duas datas cai no padrão", () => {
    expect(resolverPeriodo("custom", "2026-01-01", "2026-01-31", hoje)).toEqual({
      inicio: "2026-01-01",
      fim: "2026-01-31",
    });
    expect(resolverPeriodo("custom", "2026-01-01", "", hoje, "7d")).toEqual({
      inicio: "2026-03-04",
      fim: hoje,
    });
  });
});

describe("opções do filtro múltiplo", () => {
  const opcoes = [
    { valor: "SAO", rotulo: "São Paulo" },
    { valor: "CAS", rotulo: "Cascavel", apagada: true },
    { valor: "CWB", rotulo: "Curitiba" },
  ];
  it("marcadas primeiro, apagadas no fim, busca sem acento", () => {
    expect(opcoesVisiveis(opcoes, ["CWB"], "").map((o) => o.valor)).toEqual(["CWB", "SAO", "CAS"]);
    expect(opcoesVisiveis(opcoes, [], "sao").map((o) => o.valor)).toEqual(["SAO"]);
    expect(opcoesVisiveis(opcoes, ["XXX"], "zzz").map((o) => o.valor)).toEqual(["XXX"]);
  });
});

describe("seleção adiada", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("vários cliques viram uma mudança só, depois da pausa", () => {
    const aoMudar = vi.fn();
    const { result } = renderHook(() => useSelecaoAdiada<string>([], aoMudar));
    act(() => {
      result.current.alterar(["A"]);
    });
    act(() => {
      result.current.alterar(["A", "B"]);
    });
    expect(result.current.selecionados).toEqual(["A", "B"]);
    expect(aoMudar).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(ATRASO_FILTRO_MS);
    });
    expect(aoMudar).toHaveBeenCalledTimes(1);
    expect(aoMudar).toHaveBeenCalledWith(["A", "B"]);
  });

  it("fechar o seletor aplica na hora; limpar é imediato", () => {
    const aoMudar = vi.fn();
    const { result } = renderHook(() => useSelecaoAdiada<string>(["A"], aoMudar));
    act(() => {
      result.current.alterar(["A", "B"]);
      result.current.aplicar();
    });
    expect(aoMudar).toHaveBeenLastCalledWith(["A", "B"]);
    act(() => {
      result.current.alterar([], true);
    });
    expect(aoMudar).toHaveBeenLastCalledWith([]);
  });

  it("mudança de fora (Limpar filtros) atualiza o rascunho", () => {
    const { result, rerender } = renderHook(
      ({ valores }: { valores: string[] }) => useSelecaoAdiada(valores, vi.fn()),
      { initialProps: { valores: ["A"] } },
    );
    rerender({ valores: [] });
    expect(result.current.selecionados).toEqual([]);
  });
});

describe("FiltroMultiplo", () => {
  it("mostra 'todas' sem seleção e limpa pelo x", () => {
    vi.useFakeTimers();
    const aoMudar = vi.fn();
    const { rerender } = render(
      <FiltroMultiplo rotulo="Unidade" opcoes={[]} selecionados={[]} aoMudar={aoMudar} />,
    );
    expect(screen.getByRole("button", { name: /Unidade todas/ })).toBeTruthy();
    rerender(
      <FiltroMultiplo
        rotulo="Unidade"
        opcoes={[{ valor: "CAS", rotulo: "Cascavel" }]}
        selecionados={["CAS"]}
        aoMudar={aoMudar}
      />,
    );
    expect(screen.getByText("Cascavel")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Limpar unidade" }));
    expect(aoMudar).toHaveBeenCalledWith([]);
    vi.useRealTimers();
  });
});

describe("FiltrandoPor", () => {
  it("some sem filtro; resume nomes com +N", () => {
    const { container } = render(<FiltrandoPor etiquetas={[false, null, ""]} />);
    expect(container.textContent).toBe("");
    expect(resumirNomes(["A", "B", "C", "D", "E"])).toEqual({
      valor: "A · B · C +2",
      completo: "A\nB\nC\nD\nE",
    });
    const limpar = vi.fn();
    render(<FiltrandoPor etiquetas={[{ rotulo: "Parceiros", valor: "Natura", limpar }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Tirar o filtro de parceiros" }));
    expect(limpar).toHaveBeenCalled();
  });
});
