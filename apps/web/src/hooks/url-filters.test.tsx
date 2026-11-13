import { z } from "@erp/shared/zod";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { campoFiltro, filtrosAtivos, lerFiltros, semPadroes } from "./url-filters";
import { useFiltrosNaUrl } from "./use-url-filters";

afterEach(cleanup);
// O roteador restaura a rolagem; o jsdom não implementa scrollTo.
beforeAll(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

const PERIODOS = ["hoje", "7d", "mes", "custom"] as const;
const esquema = z.object({
  periodo: campoFiltro.opcao(PERIODOS, "mes"),
  de: campoFiltro.data(),
  unidades: campoFiltro.lista(),
  ctrc: campoFiltro.texto(),
  pagina: campoFiltro.pagina(),
});
const PADRAO = { periodo: "mes", de: "", unidades: [], ctrc: "", pagina: 1 };

describe("leitura dos filtros", () => {
  it("sem nada na URL, tudo no padrão", () => {
    expect(lerFiltros(esquema, {})).toEqual(PADRAO);
  });

  it("aceita número onde é texto e valor solto onde é lista", () => {
    expect(lerFiltros(esquema, { ctrc: 33214, unidades: "CAS" })).toMatchObject({
      ctrc: "33214",
      unidades: ["CAS"],
    });
  });

  it("valor inválido volta ao padrão sem derrubar os outros", () => {
    expect(
      lerFiltros(esquema, { periodo: "ontem", de: "2026-02-30", pagina: -3, unidades: ["X"] }),
    ).toEqual({ ...PADRAO, unidades: ["X"] });
  });

  it("URL limpa: filtro no padrão sai; parâmetro de fora do esquema fica", () => {
    expect(semPadroes({ periodo: "mes", unidades: ["A"], aba: "total" }, PADRAO)).toEqual({
      unidades: ["A"],
      aba: "total",
    });
    expect(filtrosAtivos({ ...PADRAO, ctrc: "1" }, PADRAO)).toEqual(["ctrc"]);
  });
});

function Tela() {
  const { filtros, definir, limpar, ativos } = useFiltrosNaUrl(esquema);
  return (
    <div>
      <output data-testid="filtros">{JSON.stringify(filtros)}</output>
      <output data-testid="ativos">{ativos.join(",")}</output>
      <button
        type="button"
        onClick={() => {
          definir({ unidades: ["CAS", "SPO"], periodo: "7d" });
        }}
      >
        definir
      </button>
      <button
        type="button"
        onClick={() => {
          limpar(["periodo"]);
        }}
      >
        limpar
      </button>
    </div>
  );
}

describe("useFiltrosNaUrl", () => {
  it("lê da URL, grava mudanças e limpa mantendo o que foi pedido", async () => {
    const history = createMemoryHistory({ initialEntries: ["/?ctrc=123&aba=%22total%22"] });
    const router = createRouter({ routeTree: createRootRoute({ component: Tela }), history });
    render(<RouterProvider router={router} />);

    const filtros = () => JSON.parse(screen.getByTestId("filtros").textContent) as unknown;
    await waitFor(() => {
      expect(filtros()).toEqual({ ...PADRAO, ctrc: "123" });
    });

    act(() => {
      screen.getByRole("button", { name: "definir" }).click();
    });
    await waitFor(() => {
      expect(screen.getByTestId("ativos").textContent).toBe("periodo,unidades,ctrc");
    });
    expect(router.state.location.search).toEqual({
      ctrc: 123,
      aba: "total",
      unidades: ["CAS", "SPO"],
      periodo: "7d",
    });

    act(() => {
      screen.getByRole("button", { name: "limpar" }).click();
    });
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ aba: "total", periodo: "7d" });
    });
  });
});
