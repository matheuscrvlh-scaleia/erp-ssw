import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ModalNovoUsuario } from "./NewUserModal";

afterEach(cleanup);

// O Select do Radix rola até a opção marcada ao abrir; o jsdom não tem `scrollIntoView`.
beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined;
});

const CARGOS = [
  { chave: "operador", rotulo: "Operador" },
  { chave: "admin", rotulo: "Admin" },
];

const digitar = (rotulo: string, valor: string) => {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
};

/** Abre o `ui/select` pelo rótulo e marca a opção. */
const escolher = (rotulo: string, opcao: string) => {
  fireEvent.click(screen.getByLabelText(rotulo));
  fireEvent.click(screen.getByRole("option", { name: opcao }));
};

describe("ModalNovoUsuario", () => {
  it("convite: só habilita com nome e e-mail válidos e manda o modo convite", async () => {
    const aoGravar = vi.fn(() => Promise.resolve(true));
    render(<ModalNovoUsuario cargos={CARGOS} aoGravar={aoGravar} />);
    fireEvent.click(screen.getByRole("button", { name: /Novo usuário/ }));
    const enviar = screen.getByRole("button", { name: "Enviar convite" });
    expect(enviar.hasAttribute("disabled")).toBe(true);
    digitar("Nome", "Ana");
    digitar("E-mail", " Ana@FR.com.br ");
    escolher("Cargo", "Admin");
    fireEvent.click(enviar);
    await waitFor(() => {
      expect(aoGravar).toHaveBeenCalledWith({
        modo: "convite",
        nome: "Ana",
        email: "ana@fr.com.br",
        papel: "admin",
      });
    });
  });

  it("com senha: exige 8 caracteres; erro na gravação mantém o modal aberto", async () => {
    const aoGravar = vi.fn(() => Promise.resolve(false));
    render(<ModalNovoUsuario cargos={CARGOS} aoGravar={aoGravar} />);
    fireEvent.click(screen.getByRole("button", { name: /Novo usuário/ }));
    // A aba do Radix troca no mousedown (o clique de verdade começa por ele).
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Criar com senha" }));
    digitar("Nome", "Bia");
    digitar("E-mail", "bia@fr.com.br");
    digitar("Senha", "curta");
    const criar = screen.getByRole("button", { name: "Criar usuário" });
    expect(criar.hasAttribute("disabled")).toBe(true);
    digitar("Senha", "uma-senha-boa");
    fireEvent.click(criar);
    await waitFor(() => {
      expect(aoGravar).toHaveBeenCalledWith(
        expect.objectContaining({ modo: "senha", senha: "uma-senha-boa" }),
      );
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
