import { describe, expect, it } from "vitest";

import { chaveDaRegra, normalizarRegra } from "./prazos-configurados";

describe("normalizarRegra", () => {
  const base = {
    unidadeCodigo: null,
    unidadeDestinoCodigo: null,
    parceiroCnpj: null,
    parceiroNome: null,
    prazoHoras: null,
    prazoDias: null,
    ativo: true,
  };

  it("exige os campos do tipo, com a mensagem de hoje", () => {
    expect(() => normalizarRegra({ ...base, tipo: "unidade", unidadeCodigo: "CAP" })).toThrow(
      "Unidade e horas são obrigatórias",
    );
    expect(() => normalizarRegra({ ...base, tipo: "parceiro", prazoDias: 2 })).toThrow(
      "Parceiro e dias são obrigatórios",
    );
    expect(() =>
      normalizarRegra({ ...base, tipo: "transbordo", unidadeCodigo: "CAP", prazoDias: 2 }),
    ).toThrow("Origem, destino e dias são obrigatórios");
  });

  it("limpa os campos que não são do tipo", () => {
    expect(
      normalizarRegra({
        ...base,
        tipo: "unidade",
        unidadeCodigo: "CAP",
        prazoHoras: 24,
        parceiroCnpj: "X",
        prazoDias: 3,
      }),
    ).toMatchObject({ unidadeCodigo: "CAP", prazoHoras: 24, parceiroCnpj: null, prazoDias: null });
  });
});

describe("apoios", () => {
  it("chave natural por tipo", () => {
    const transbordo = { unidadeCodigo: "A", unidadeDestinoCodigo: "B", parceiroCnpj: null };
    expect(chaveDaRegra({ ...transbordo, tipo: "transbordo" })).toBe("transbordo:A>B");
    expect(chaveDaRegra({ ...transbordo, tipo: "unidade" })).toBe("unidade:A");
  });
});
