import { type UsuarioDaEmpresa } from "@erp/shared/contratos/admin";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { chaveDoNome } from "./cadastros/PaginaDeCadastro";
import { listaDasExcecoes, mapaDasExcecoes, trocasDeExcecao } from "./telas";
import { gerarSenha, ModalEditarUsuario } from "./usuarios/ModalEditarUsuario";
import { ModalNovoUsuario } from "./usuarios/ModalNovoUsuario";

afterEach(cleanup);

const CARGOS = [
  { chave: "operador", rotulo: "Operador" },
  { chave: "admin", rotulo: "Admin" },
];
const DEPARTAMENTOS = [{ chave: "expedicao", rotulo: "Expedição" }];

const digitar = (rotulo: string, valor: string) => {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
};

describe("exceções de tela", () => {
  it("Ranking grava as duas chaves e a volta não duplica", () => {
    const lista = listaDasExcecoes({ ranking: false, romaneio: true });
    expect(lista).toEqual([
      { tela: "romaneio", permitido: true },
      { tela: "ranking", permitido: false },
      { tela: "ranking_novo", permitido: false },
    ]);
    expect(listaDasExcecoes(mapaDasExcecoes(lista))).toEqual(lista);
  });

  it("trocas agrupadas por categoria, só onde mudou", () => {
    const trocas = trocasDeExcecao(
      { romaneio: true },
      { romaneio: false, calendario: true },
      (t) => t,
    );
    expect(trocas.map((c) => [c.chave, c.trocas.map((t) => [t.tela, t.antes, t.depois])])).toEqual([
      ["operacional", [["romaneio", "Liberar", "Bloquear"]]],
      ["consulta", [["calendario", "Padrão", "Liberar"]]],
    ]);
  });

  it("chave sugerida pelo nome e senha gerada sem caracteres ambíguos", () => {
    expect(chaveDoNome("Financeiro Jr. São Paulo")).toBe("financeiro_jr_sao_paulo");
    const senha = gerarSenha();
    expect(senha).toHaveLength(16);
    expect(senha).not.toMatch(/[0O1lI]/);
  });
});

describe("ModalNovoUsuario", () => {
  it("convite: só habilita com nome e e-mail válidos e manda o modo convite", async () => {
    const aoGravar = vi.fn(() => Promise.resolve(true));
    render(<ModalNovoUsuario cargos={CARGOS} departamentos={DEPARTAMENTOS} aoGravar={aoGravar} />);
    fireEvent.click(screen.getByRole("button", { name: /Novo usuário/ }));
    const enviar = screen.getByRole("button", { name: "Enviar convite" });
    expect(enviar.hasAttribute("disabled")).toBe(true);
    digitar("Nome", "Ana");
    digitar("E-mail", " Ana@FR.com.br ");
    digitar("Departamento", "expedicao");
    fireEvent.click(enviar);
    await waitFor(() => {
      expect(aoGravar).toHaveBeenCalledWith({
        modo: "convite",
        nome: "Ana",
        email: "ana@fr.com.br",
        papel: "operador",
        departamento: "expedicao",
        excecoes: [],
      });
    });
  });

  it("com senha: exige 8 caracteres; erro na gravação mantém o modal aberto", async () => {
    const aoGravar = vi.fn(() => Promise.resolve(false));
    render(<ModalNovoUsuario cargos={CARGOS} departamentos={[]} aoGravar={aoGravar} />);
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

const USUARIO: UsuarioDaEmpresa = {
  id: "00000000-0000-4000-8000-000000000001",
  nome: "Caio",
  email: "caio@fr.com.br",
  setor: null,
  departamento: null,
  papel: "operador",
  ativo: true,
  temSenha: true,
  excecoes: [{ tela: "romaneio", permitido: true }],
};

describe("ModalEditarUsuario", () => {
  it("revisa as alterações por grupo antes de salvar", async () => {
    const aoGravar = vi.fn(() => Promise.resolve(true));
    render(
      <ModalEditarUsuario
        usuario={USUARIO}
        cargos={CARGOS}
        departamentos={DEPARTAMENTOS}
        aoGravar={aoGravar}
        aoDefinirSenha={() => Promise.resolve(true)}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Editar usuário" }));
    expect(screen.getAllByRole("button", { name: "Fechar" }).length).toBeGreaterThan(1);
    digitar("Nível", "admin");
    digitar("Romaneio", "padrao");
    fireEvent.click(screen.getByRole("button", { name: "Revisar alterações" }));
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByText("Operador")).toBeTruthy();
    expect(within(dialogo).getByText("Admin")).toBeTruthy();
    expect(within(dialogo).getByText("1 alteração")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar e salvar" }));
    await waitFor(() => {
      expect(aoGravar).toHaveBeenCalledWith({
        nome: "Caio",
        email: "caio@fr.com.br",
        papel: "admin",
        departamento: null,
        ativo: true,
        excecoes: [],
      });
    });
  });
});
