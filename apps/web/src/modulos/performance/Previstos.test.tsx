import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Toaster } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SecaoPrevistos } from "./Previstos";

afterEach(cleanup);

const somas = (qtd: number) => ({ qtd, peso: 1500, volumes: 2, frete: 100 });

describe("SecaoPrevistos", () => {
  it("esconde 'Outros' e 'Sem previsão' zerados; clique abre a lista do eixo", () => {
    const onClique = vi.fn();
    render(
      <SecaoPrevistos
        dados={{
          status: [{ key: "rota", ...somas(3) }],
          faixa: [{ key: "vencido", ...somas(3) }],
          total: somas(3),
        }}
        carregando={false}
        ignorarPeriodo={false}
        onIgnorarPeriodo={vi.fn()}
        onClique={onClique}
      />,
    );
    expect(screen.queryByText("Outros")).toBeNull();
    expect(screen.queryByText("Sem previsão")).toBeNull();
    expect(screen.getByText("3 no total", { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByText("Vencido"));
    expect(onClique).toHaveBeenCalledWith({ eixo: "faixa", chave: "vencido" });
    fireEvent.click(screen.getByText("Total previstos"));
    expect(onClique).toHaveBeenLastCalledWith({ eixo: "total" });
  });

  it("alternador 'Todos em aberto' avisa (em notificação) que sai da partição", async () => {
    const onIgnorar = vi.fn();
    const { rerender } = render(
      <SecaoPrevistos
        dados={undefined}
        carregando
        ignorarPeriodo={false}
        onIgnorarPeriodo={onIgnorar}
        onClique={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Todos em aberto"));
    expect(onIgnorar).toHaveBeenCalledWith(true);
    rerender(
      <>
        <SecaoPrevistos
          dados={undefined}
          carregando
          ignorarPeriodo
          onIgnorarPeriodo={onIgnorar}
          onClique={vi.fn()}
        />
        <Toaster />
      </>,
    );
    expect(await screen.findByText("sai da partição de 100%")).toBeTruthy();
  });
});
