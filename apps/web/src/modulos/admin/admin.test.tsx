import { CATEGORIAS_DE_TELA, type Permissao } from "@erp/shared/acesso/permissoes";
import { type UsuarioDaEmpresa } from "@erp/shared/contratos/admin";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  alternarAcao,
  definirExcecao,
  linhasDaTela,
  listaDasExcecoes,
  mapaDasExcecoes,
  type Matriz,
  permissoesEfetivas,
  resumoDoAcesso,
} from "./permissoes";
import { chaveDoNome } from "./usuarios/AbaCargos";
import { MatrizDeCargos } from "./usuarios/AbaMatriz";
import { gerarSenha, ModalEditarUsuario } from "./usuarios/ModalEditarUsuario";
import { ModalNovoUsuario } from "./usuarios/ModalNovoUsuario";

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

describe("permissões por ação", () => {
  it("ligar Criar/Editar liga o Ver; desligar o Ver tira tudo da tela", () => {
    const comEditar = alternarAcao(new Set(), "calendario", "editar", true);
    expect([...comEditar].sort()).toEqual(["calendario.editar", "calendario.ver"]);
    const comExcluir = alternarAcao(comEditar, "calendario", "excluir", true);
    expect(alternarAcao(comExcluir, "calendario", "ver", false).size).toBe(0);
  });

  it("acessos tem uma linha por tela; permissões, uma por evento e os recursos", () => {
    expect(linhasDaTela("acessos", "historico")).toEqual([
      { tela: "historico", acao: "ver", rotulo: "Histórico" },
    ]);
    expect(linhasDaTela("permissoes", "historico").map((l) => l.rotulo)).toEqual([
      "Histórico · Criar/Editar",
      "Histórico · Excluir",
    ]);
    expect(linhasDaTela("permissoes", "romaneio")).toEqual([]);
    expect(linhasDaTela("acessos", "romaneio_placa")).toEqual([]);
    expect(linhasDaTela("permissoes", "romaneio_placa").map((l) => l.acao)).toEqual(["ver"]);
  });

  it("Ranking grava as duas chaves e a volta não duplica", () => {
    const mapa = definirExcecao(
      definirExcecao({}, "ranking", "ver", "nega"),
      "romaneio",
      "ver",
      "concede",
    );
    const lista = listaDasExcecoes(mapa);
    expect(lista).toEqual([
      { permissao: "ranking.ver", efeito: "nega" },
      { permissao: "ranking_novo.ver", efeito: "nega" },
      { permissao: "romaneio.ver", efeito: "concede" },
    ]);
    expect(listaDasExcecoes(mapaDasExcecoes(lista))).toEqual(lista);
    expect(definirExcecao(mapa, "ranking", "ver", undefined)).toEqual({
      "romaneio.ver": "concede",
    });
  });

  it("acesso efetivo = cargo + Sim − Não, e o resumo conta o Ranking uma vez", () => {
    const mapa = definirExcecao(
      definirExcecao({}, "ranking", "ver", "nega"),
      "romaneio",
      "ver",
      "concede",
    );
    const efetivas = permissoesEfetivas(
      "operador",
      ["ranking.ver", "ranking_novo.ver", "historico.ver"],
      mapa,
    );
    expect([...efetivas].sort()).toEqual(["historico.ver", "romaneio.ver"]);
    expect(resumoDoAcesso(mapa, efetivas)).toBe("2 exceções · 2 permissões ativas");
  });

  it("chave sugerida pelo nome e senha gerada sem caracteres ambíguos", () => {
    expect(chaveDoNome("Financeiro Jr. São Paulo")).toBe("financeiro_jr_sao_paulo");
    const senha = gerarSenha();
    expect(senha).toHaveLength(16);
    expect(senha).not.toMatch(/[0O1lI]/);
  });
});

describe("MatrizDeCargos", () => {
  const montar = (matriz: Matriz, permissoes: Permissao[]) => {
    const gravar = vi.fn(() => Promise.resolve(true));
    const gravacao = { gravar, gravando: false };
    render(
      <MatrizDeCargos
        matriz={matriz}
        cargos={[
          {
            chave: "operador",
            rotulo: "Operador",
            protegido: false,
            temTudo: false,
            permissoes,
            usuarios: 0,
          },
        ]}
        carregando={false}
        erro={null}
        aoTentarDeNovo={() => undefined}
        podeEditar
        catalogo={{
          categorias: CATEGORIAS_DE_TELA,
          avisoTemTudo: "",
          gravacoes: { criar: gravacao, alterar: gravacao, excluir: gravacao },
        }}
      />,
    );
    return gravar;
  };

  it("acessos: marcar a tela libera só o Ver, sem os eventos dela", () => {
    const gravar = montar("acessos", []);
    expect(screen.queryByLabelText("Operador: Coletas · Criar/Editar")).toBeNull();
    fireEvent.click(screen.getByLabelText("Operador: Coletas"));
    expect(gravar).toHaveBeenCalledWith({
      chave: "operador",
      rotulo: "Operador",
      permissoes: ["coletas.ver"],
    });
  });

  it("permissões: evento fica travado sem a tela e liga só a sua linha com ela", () => {
    const gravar = montar("permissoes", ["historico.ver"]);
    expect(screen.queryByLabelText("Operador: Histórico")).toBeNull();
    const semTela = screen.getByLabelText("Operador: Coletas · Criar/Editar");
    expect(semTela.hasAttribute("disabled")).toBe(true);
    expect(semTela.getAttribute("title")).toBe("Libere a tela na Matriz de acessos");
    fireEvent.click(screen.getByLabelText("Operador: Histórico · Excluir"));
    expect(gravar).toHaveBeenCalledWith({
      chave: "operador",
      rotulo: "Operador",
      permissoes: ["historico.ver", "historico.excluir"],
    });
  });
});

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
