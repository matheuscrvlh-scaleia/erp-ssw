import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type FeriadoParaGravar, ModalDeFeriado } from "./HolidayModal";

afterEach(cleanup);

function abrir(aoGravar: (f: FeriadoParaGravar) => Promise<boolean>) {
  const aoMudarAberto = vi.fn();
  render(
    <ModalDeFeriado
      aberto
      aoMudarAberto={aoMudarAberto}
      editando={null}
      hoje="2026-11-10"
      aoGravar={aoGravar}
    />,
  );
  return { aoMudarAberto };
}

const digitar = (rotulo: string, valor: string) => {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
};

describe("ModalDeFeriado", () => {
  it("municipal sem cidade: mostra a regra do domínio e não grava", async () => {
    const aoGravar = vi.fn(() => Promise.resolve(true));
    abrir(aoGravar);
    digitar("Descrição", "Padroeira");
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    expect(
      await screen.findByText("Cidade e UF são obrigatórios para feriado municipal"),
    ).toBeTruthy();
    expect(aoGravar).not.toHaveBeenCalled();
  });

  it("municipal completo: grava recorrente e fecha", async () => {
    const aoGravar = vi.fn(() => Promise.resolve(true));
    const { aoMudarAberto } = abrir(aoGravar);
    digitar("UF", "SP");
    digitar("Cidade", "  Campinas ");
    digitar("Descrição", "Padroeira");
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    await waitFor(() => {
      expect(aoMudarAberto).toHaveBeenCalledWith(false);
    });
    expect(aoGravar).toHaveBeenCalledWith({
      dados: {
        data: "2026-11-10",
        tipo: "municipal",
        cidade: "Campinas",
        uf: "SP",
        descricao: "Padroeira",
      },
      recorrente: true,
    });
  });

  it("nacional não leva cidade nem UF; erro na gravação deixa o modal aberto", async () => {
    const aoGravar = vi.fn((_f: FeriadoParaGravar) => Promise.resolve(false));
    const { aoMudarAberto } = abrir(aoGravar);
    digitar("UF", "SP");
    fireEvent.click(screen.getByRole("button", { name: "nacional" }));
    digitar("Descrição", "Dia de teste");
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    await waitFor(() => {
      expect(aoGravar).toHaveBeenCalled();
    });
    expect(aoGravar.mock.calls[0]?.[0].dados).toMatchObject({
      tipo: "nacional",
      cidade: null,
      uf: null,
    });
    expect(aoMudarAberto).not.toHaveBeenCalledWith(false);
  });
});
