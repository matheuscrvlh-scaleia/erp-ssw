import { CATEGORIAS_DE_TELA, type Permissao } from "@erp/shared/acesso/permissoes";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type Matriz } from "../regras";
import { MatrizDeCargos } from "./MatrizDeCargos";

afterEach(cleanup);

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
