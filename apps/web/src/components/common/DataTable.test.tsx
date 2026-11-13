import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ErroDaApi } from "@/lib/api";

import {
  type ColunaTabela,
  compararValores,
  fatiarPagina,
  ordenarLinhas,
  proximaOrdenacao,
} from "./data-table";
import { TabelaDados } from "./DataTable";

afterEach(cleanup);

interface Linha {
  id: string;
  cliente: string | null;
  frete: number | null;
}

const COLUNAS: ColunaTabela<Linha>[] = [
  { chave: "id", titulo: "CT-e" },
  { chave: "cliente", titulo: "Cliente" },
  { chave: "frete", titulo: "Frete", formato: "moeda" },
];

const LINHAS: Linha[] = [
  { id: "A2", cliente: "Zeta", frete: 10 },
  { id: "A10", cliente: null, frete: 2 },
  { id: "A1", cliente: "álvaro", frete: null },
];

describe("regras da tabela", () => {
  it("vazio vai para o fim nas duas direções; texto em ordem pt-BR com números", () => {
    expect(compararValores(null, "a", "asc")).toBe(1);
    expect(compararValores(null, "a", "desc")).toBe(1);
    const porCte = ordenarLinhas(LINHAS, COLUNAS[0], "asc").map((l) => l.id);
    expect(porCte).toEqual(["A1", "A2", "A10"]);
    const porCliente = ordenarLinhas(LINHAS, COLUNAS[1], "asc").map((l) => l.id);
    expect(porCliente).toEqual(["A1", "A2", "A10"]);
    const porFreteDesc = ordenarLinhas(LINHAS, COLUNAS[2], "desc").map((l) => l.id);
    expect(porFreteDesc).toEqual(["A2", "A10", "A1"]);
  });

  it("página fora do intervalo volta para a última válida", () => {
    expect(fatiarPagina([1, 2, 3, 4, 5], 9, 2)).toEqual({ linhas: [5], pagina: 3 });
    expect(fatiarPagina([1, 2], 1, 0)).toEqual({ linhas: [1, 2], pagina: 1 });
  });

  it("clicar de novo inverte; coluna nova começa crescente", () => {
    expect(proximaOrdenacao(null, "a")).toEqual({ chave: "a", direcao: "asc" });
    expect(proximaOrdenacao({ chave: "a", direcao: "asc" }, "a")).toEqual({
      chave: "a",
      direcao: "desc",
    });
    expect(proximaOrdenacao({ chave: "a", direcao: "desc" }, "b")).toEqual({
      chave: "b",
      direcao: "asc",
    });
  });
});

const corpo = () => screen.getAllByRole("rowgroup")[1]!;
const primeiraColuna = () =>
  within(corpo())
    .getAllByRole("row")
    .map((r) => within(r).getAllByRole("cell")[0]!.textContent);

describe("TabelaDados", () => {
  it("formata, ordena pelo cabeçalho e marca aria-sort", () => {
    render(<TabelaDados colunas={COLUNAS} linhas={LINHAS} chaveDaLinha={(l) => l.id} />);
    // A moeda do Intl separa "R$" do número com espaço não separável.
    expect(screen.getByText((texto) => texto.replace(/\s/g, " ") === "R$ 10,00")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /CT-e/ }));
    expect(primeiraColuna()).toEqual(["A1", "A2", "A10"]);
    expect(screen.getByRole("columnheader", { name: /CT-e/ }).getAttribute("aria-sort")).toBe(
      "ascending",
    );
    fireEvent.click(screen.getByRole("button", { name: /CT-e/ }));
    expect(primeiraColuna()).toEqual(["A10", "A2", "A1"]);
  });

  it("pagina no cliente e mostra o total no rodapé", () => {
    render(
      <TabelaDados colunas={COLUNAS} linhas={LINHAS} chaveDaLinha={(l) => l.id} porPagina={2} />,
    );
    expect(screen.getByText("3 registro(s) · Página 1 de 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(primeiraColuna()).toEqual(["A1"]);
    expect(screen.getByRole("button", { name: "Próxima" }).hasAttribute("disabled")).toBe(true);
  });

  it("linha clicável responde a clique e a Enter", () => {
    const aoClicar = vi.fn<(linha: Linha) => void>();
    render(
      <TabelaDados
        colunas={COLUNAS}
        linhas={LINHAS}
        chaveDaLinha={(l) => l.id}
        aoClicarLinha={aoClicar}
      />,
    );
    const linhas = within(corpo()).getAllByRole("row");
    fireEvent.click(linhas[0]!);
    fireEvent.keyDown(linhas[1]!, { key: "Enter" });
    expect(aoClicar.mock.calls.map(([l]) => l.id)).toEqual(["A2", "A10"]);
  });

  it("ordenação controlada não reordena, só avisa; paginação no servidor usa o total", () => {
    const aoOrdenar = vi.fn();
    const aoMudarPagina = vi.fn();
    render(
      <TabelaDados
        colunas={COLUNAS}
        linhas={LINHAS}
        chaveDaLinha={(l) => l.id}
        ordenacao={null}
        aoOrdenar={aoOrdenar}
        paginacaoServidor={{ pagina: 1, porPagina: 3, total: 120, aoMudarPagina }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Cliente/ }));
    expect(aoOrdenar).toHaveBeenCalledWith({ chave: "cliente", direcao: "asc" });
    expect(primeiraColuna()).toEqual(["A2", "A10", "A1"]);
    expect(screen.getByText("120 registro(s) · Página 1 de 40")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(aoMudarPagina).toHaveBeenCalledWith(2);
  });

  it("estados: carregando, erro amigável e vazio", () => {
    const { rerender } = render(
      <TabelaDados colunas={COLUNAS} linhas={[]} chaveDaLinha={(l) => l.id} carregando />,
    );
    expect(screen.getByText("Carregando…")).toBeTruthy();
    rerender(
      <TabelaDados
        colunas={COLUNAS}
        linhas={[]}
        chaveDaLinha={(l) => l.id}
        erro={new ErroDaApi("TEMPO_ESGOTADO", "Reduza o período.", 503)}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("Reduza o período.");
    rerender(
      <TabelaDados
        colunas={COLUNAS}
        linhas={[]}
        chaveDaLinha={(l) => l.id}
        mensagemVazia="Nenhuma coleta encontrada."
      />,
    );
    expect(screen.getByText("Nenhuma coleta encontrada.")).toBeTruthy();
  });

  it("coluna oculta começa escondida", () => {
    render(
      <TabelaDados
        colunas={[...COLUNAS, { chave: "extra", titulo: "Extra", oculta: true }]}
        linhas={LINHAS}
        chaveDaLinha={(l) => l.id}
      />,
    );
    expect(screen.queryByRole("columnheader", { name: /Extra/ })).toBeNull();
  });
});
