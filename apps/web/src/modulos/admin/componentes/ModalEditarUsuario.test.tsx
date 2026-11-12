import { type UsuarioDaEmpresa } from "@erp/shared/contratos/admin";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ModalEditarUsuario } from "./ModalEditarUsuario";

afterEach(cleanup);

// O Select do Radix rola até a opção marcada ao abrir; o jsdom não tem `scrollIntoView`.
beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined;
});

const CARGOS = [
  { chave: "operador", rotulo: "Operador" },
  { chave: "admin", rotulo: "Admin" },
];

/** Abre o `ui/select` pelo rótulo e marca a opção. */
const escolher = (rotulo: string, opcao: string) => {
  fireEvent.click(screen.getByLabelText(rotulo));
  fireEvent.click(screen.getByRole("option", { name: opcao }));
};

const USUARIO: UsuarioDaEmpresa = {
  id: "00000000-0000-4000-8000-000000000001",
  nome: "Caio",
  email: "caio@fr.com.br",
  papel: "operador",
  ativo: true,
  temSenha: true,
  excecoes: [{ permissao: "romaneio.ver", efeito: "concede" }],
};

describe("ModalEditarUsuario", () => {
  it("revisa a troca de cargo antes de salvar (exceções ficam em Permissões)", async () => {
    const aoGravar = vi.fn(() => Promise.resolve(true));
    render(
      <ModalEditarUsuario
        usuario={USUARIO}
        cargos={CARGOS}
        aoGravar={aoGravar}
        aoDefinirSenha={() => Promise.resolve(true)}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Editar usuário" }));
    expect(screen.getAllByRole("button", { name: "Fechar" }).length).toBeGreaterThan(1);
    escolher("Cargo", "Admin");
    fireEvent.click(screen.getByRole("button", { name: "Revisar alterações" }));
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByText("Operador")).toBeTruthy();
    expect(within(dialogo).getByText("Admin")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar e salvar" }));
    await waitFor(() => {
      expect(aoGravar).toHaveBeenCalledWith({
        nome: "Caio",
        email: "caio@fr.com.br",
        papel: "admin",
        ativo: true,
      });
    });
  });
});
