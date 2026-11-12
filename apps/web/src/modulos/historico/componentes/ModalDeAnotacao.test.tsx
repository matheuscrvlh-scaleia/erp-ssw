import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ModalDeAnotacao } from "./ModalDeAnotacao";

afterEach(cleanup);

describe("ModalDeAnotacao", () => {
  const abrir = (aoGravar: (d: unknown, id: string | null) => Promise<boolean>) => {
    const aoMudarAberto = vi.fn();
    render(
      <ModalDeAnotacao
        aberto
        aoMudarAberto={aoMudarAberto}
        abertura={{ data: "2026-11-05" }}
        hoje="2026-11-10"
        unidades={[]}
        podeExcluir={false}
        aoGravar={aoGravar}
        aoExcluir={() => Promise.resolve(true)}
      />,
    );
    return { aoMudarAberto };
  };

  it("texto vazio não grava", async () => {
    const aoGravar = vi.fn(() => Promise.resolve(true));
    abrir(aoGravar);
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Escreva o que aconteceu")).toBeTruthy();
    expect(aoGravar).not.toHaveBeenCalled();
  });

  it("Ctrl+Enter grava na data escolhida e mantém aberto para a próxima", async () => {
    const aoGravar = vi.fn((_d: unknown, _id: string | null) => Promise.resolve(true));
    const { aoMudarAberto } = abrir(aoGravar);
    fireEvent.click(screen.getByRole("button", { name: /Clima/ }));
    const texto = screen.getByRole("textbox");
    fireEvent.change(texto, { target: { value: "  Alagamento  " } });
    fireEvent.keyDown(texto, { key: "Enter", ctrlKey: true });
    await waitFor(() => {
      expect(aoGravar).toHaveBeenCalledWith(
        { data: "2026-11-05", tipo: "clima", texto: "Alagamento", unidadeId: null },
        null,
      );
    });
    expect(aoMudarAberto).not.toHaveBeenCalledWith(false);
    await waitFor(() => {
      expect((texto as HTMLTextAreaElement).value).toBe("");
    });
  });
});
