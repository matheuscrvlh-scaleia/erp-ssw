import { describe, expect, it } from "vitest";

import { carregarTodasAsPaginas, MENSAGEM_DADOS_MUDARAM } from "./paginas";

describe("carregarTodasAsPaginas", () => {
  it("junta as páginas até o total", async () => {
    const dados = Array.from({ length: 1200 }, (_, i) => i);
    const todas = await carregarTodasAsPaginas((pagina, tamanho) =>
      Promise.resolve({
        linhas: dados.slice((pagina - 1) * tamanho, pagina * tamanho),
        total: dados.length,
      }),
    );
    expect(todas).toEqual(dados);
  });

  it("total mudou no meio: avisa para atualizar", async () => {
    let total = 600;
    const buscar = (pagina: number) => {
      const r = { linhas: pagina === 1 ? Array<number>(500).fill(0) : [], total };
      total += 1;
      return Promise.resolve(r);
    };
    await expect(carregarTodasAsPaginas(buscar)).rejects.toThrow(MENSAGEM_DADOS_MUDARAM);
  });
});
