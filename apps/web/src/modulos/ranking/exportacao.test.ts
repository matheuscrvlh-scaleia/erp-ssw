import { type LinhaDoRanking } from "@erp/shared/contratos/ranking";
import { describe, expect, it } from "vitest";

import { colunasDoRanking, linhasDoRanking } from "./exportacao";

describe("exportação do ranking", () => {
  it("a coluna do Frete só sai quando o frete está visível", () => {
    const visivel = colunasDoRanking("Parceiro", true);
    expect(visivel[0]).toEqual({ chave: "nome", titulo: "Parceiro" });
    expect(visivel.at(-1)).toEqual({ chave: "frete", titulo: "Frete (R$)", formato: "moeda" });
    expect(colunasDoRanking("Cidade", false).map((c) => c.chave)).not.toContain("frete");
  });

  it("cada linha leva o nome mostrado na tela", () => {
    const linha = { chave: "12345678000199", rotulo: null } as unknown as LinhaDoRanking;
    expect(linhasDoRanking([linha], () => "Zeta Ltda")[0]).toMatchObject({
      chave: "12345678000199",
      nome: "Zeta Ltda",
    });
  });
});
