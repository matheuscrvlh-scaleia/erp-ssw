import { describe, expect, it } from "vitest";

import {
  chaveDaRegra,
  type CteParaPrazo,
  filiaisDeChegada,
  normalizarRegra,
  previsaoPelasRegras,
  type RegraDePrazo,
} from "./prazos-configurados";

let sequencia = 0;
function regra(dados: Partial<RegraDePrazo> & Pick<RegraDePrazo, "tipo">): RegraDePrazo {
  sequencia += 1;
  return {
    id: `00000000-0000-4000-8000-${String(sequencia).padStart(12, "0")}`,
    unidadeCodigo: null,
    unidadeDestinoCodigo: null,
    parceiroCnpj: null,
    prazoHoras: null,
    prazoDias: null,
    ativo: true,
    criadoEm: new Date(`2026-01-01T00:00:${String(sequencia % 60).padStart(2, "0")}Z`),
    ...dados,
  };
}

function cte(dados: Partial<CteParaPrazo> = {}): CteParaPrazo {
  return {
    parceiroCnpj: null,
    filial: "CAP",
    dataEmissao: "2026-11-04",
    previsaoSsw: "2026-11-09",
    previsaoSswFonte: "ssw_038",
    chegadas: new Map(),
    ...dados,
  };
}

describe("previsaoPelasRegras", () => {
  it("unidade: hora local da chegada + horas (exemplo da spec: 22:30 + 48 h = 07/11)", () => {
    const r = previsaoPelasRegras(
      cte({ chegadas: new Map([["CAP", new Date("2026-11-05T22:30:00-03:00")]]) }),
      [regra({ tipo: "unidade", unidadeCodigo: "CAP", prazoHoras: 48 })],
    );
    expect(r).toEqual({
      previsao: "2026-11-07",
      fonte: "regra_unidade",
      dataBase: new Date("2026-11-06T01:30:00Z"),
    });
  });

  it("transbordo: dia de Brasília da chegada no destino + dias (01:00Z = 05/11 em SP)", () => {
    const chegada = new Date("2026-11-06T01:00:00Z");
    const r = previsaoPelasRegras(cte({ chegadas: new Map([["RIO", chegada]]) }), [
      regra({
        tipo: "transbordo",
        unidadeCodigo: "CAP",
        unidadeDestinoCodigo: "RIO",
        prazoDias: 1,
      }),
    ]);
    expect(r).toEqual({ previsao: "2026-11-06", fonte: "regra_transbordo", dataBase: chegada });
  });

  it("transbordo com chegada no destino tira a regra de unidade da origem", () => {
    const r = previsaoPelasRegras(
      cte({
        chegadas: new Map([
          ["CAP", new Date("2026-11-05T12:00:00Z")],
          ["RIO", new Date("2026-11-07T12:00:00Z")],
        ]),
      }),
      [
        regra({ tipo: "unidade", unidadeCodigo: "CAP", prazoHoras: 24 }),
        regra({
          tipo: "transbordo",
          unidadeCodigo: "CAP",
          unidadeDestinoCodigo: "RIO",
          prazoDias: 2,
        }),
      ],
    );
    expect(r.fonte).toBe("regra_transbordo");
    expect(r.previsao).toBe("2026-11-09");
  });

  it("parceiro vence tudo e conta da emissão, à meia-noite de Brasília", () => {
    const r = previsaoPelasRegras(
      cte({
        parceiroCnpj: "12.345.678/0001-90",
        chegadas: new Map([["CAP", new Date("2026-11-05T12:00:00Z")]]),
      }),
      [
        regra({ tipo: "unidade", unidadeCodigo: "CAP", prazoHoras: 24 }),
        regra({ tipo: "parceiro", parceiroCnpj: "12.345.678/0001-90", prazoDias: 5 }),
      ],
    );
    expect(r).toEqual({
      previsao: "2026-11-09",
      fonte: "regra_parceiro",
      dataBase: new Date("2026-11-04T03:00:00Z"),
    });
  });

  it("CNPJ do parceiro compara como texto (máscara diferente não casa)", () => {
    const r = previsaoPelasRegras(cte({ parceiroCnpj: "12345678000190" }), [
      regra({ tipo: "parceiro", parceiroCnpj: "12.345.678/0001-90", prazoDias: 5 }),
    ]);
    expect(r.fonte).toBe("ssw_038");
  });

  it("sem regra que valha (inativa, sem chegada) volta a previsão do SSW", () => {
    const regras = [
      regra({ tipo: "unidade", unidadeCodigo: "CAP", prazoHoras: 24 }),
      regra({ tipo: "parceiro", parceiroCnpj: "X", prazoDias: 3, ativo: false }),
    ];
    expect(previsaoPelasRegras(cte({ parceiroCnpj: "X" }), regras)).toEqual({
      previsao: "2026-11-09",
      fonte: "ssw_038",
      dataBase: null,
    });
  });

  it("duas regras do mesmo tipo: vale a criada por último", () => {
    const chegadas = new Map([
      ["RIO", new Date("2026-11-05T12:00:00Z")],
      ["SPO", new Date("2026-11-05T12:00:00Z")],
    ]);
    const r = previsaoPelasRegras(cte({ chegadas }), [
      regra({
        tipo: "transbordo",
        unidadeCodigo: "CAP",
        unidadeDestinoCodigo: "RIO",
        prazoDias: 1,
      }),
      regra({
        tipo: "transbordo",
        unidadeCodigo: "CAP",
        unidadeDestinoCodigo: "SPO",
        prazoDias: 3,
      }),
    ]);
    expect(r.previsao).toBe("2026-11-08");
  });
});

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
    expect(
      chaveDaRegra(regra({ tipo: "transbordo", unidadeCodigo: "A", unidadeDestinoCodigo: "B" })),
    ).toBe("transbordo:A>B");
  });

  it("filiais de chegada: unidades e destinos das regras ativas", () => {
    expect(
      filiaisDeChegada([
        regra({ tipo: "unidade", unidadeCodigo: "CAP" }),
        regra({ tipo: "transbordo", unidadeCodigo: "CAP", unidadeDestinoCodigo: "RIO" }),
        regra({ tipo: "unidade", unidadeCodigo: "SPO", ativo: false }),
      ]).sort(),
    ).toEqual(["CAP", "RIO"]);
  });
});
