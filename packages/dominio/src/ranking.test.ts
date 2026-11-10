import { describe, expect, it } from "vitest";

import { agregarRanking, type BaldeRanking, chaveDoGrupo, decimalEmUnidades } from "./ranking";

const BAIXAS = new Set([12, 36, 61, 77, 92, 93, 94, 99]);

function balde(dados: Partial<BaldeRanking>): BaldeRanking {
  return {
    chave: "12345678000190",
    temDataEntrega: false,
    codigoEfetivo: null,
    noPrazo: null,
    responsabilidadeCliente: null,
    prevista: "no_prazo",
    quantidade: 1,
    pesoGramas: 0,
    volumes: 0,
    freteCentavos: 0,
    ...dados,
  };
}

describe("agregarRanking", () => {
  it("exemplo da spec (aba Parceiro, hoje 10/11): 5 CT-e do mesmo CNPJ", () => {
    const baldes = [
      balde({ temDataEntrega: true, codigoEfetivo: 1, noPrazo: true }),
      balde({
        temDataEntrega: true,
        codigoEfetivo: 1,
        noPrazo: false,
        responsabilidadeCliente: false,
      }),
      balde({
        temDataEntrega: true,
        codigoEfetivo: 1,
        noPrazo: false,
        responsabilidadeCliente: true,
      }),
      balde({ codigoEfetivo: 85, prevista: "vencida" }),
      balde({ codigoEfetivo: 85, prevista: "no_prazo" }),
    ];
    const [linha] = agregarRanking(
      baldes,
      [{ chave: "12345678000190", rotulo: "ACME", sub: null }],
      BAIXAS,
    );
    expect(linha).toMatchObject({
      rotulo: "ACME",
      totalCtes: 5,
      entregue: 3,
      noPrazo: 1,
      foraPrazo: 2,
      foraCliente: 1,
      foraTransp: 1,
      aEntregar: 2,
      atrasadas: 1,
      noPrazoAberto: 1,
    });
    expect(linha?.slaPct).toBeCloseTo(2 / 3, 10);
  });

  it("finalizado sem entrega (baixa) não está entregue nem em aberto; código 18 conta como entregue", () => {
    const [linha] = agregarRanking(
      [balde({ codigoEfetivo: 12 }), balde({ codigoEfetivo: 18, noPrazo: null })],
      [],
      BAIXAS,
    );
    expect(linha).toMatchObject({
      totalCtes: 2,
      entregue: 1,
      aEntregar: 0,
      noPrazo: 0,
      foraPrazo: 0,
    });
    expect(linha?.slaPct).toBe(1);
  });

  it("previsão nula conta como no prazo em aberto; responsabilidade nula é da transportadora", () => {
    const [linha] = agregarRanking(
      [
        balde({ prevista: "sem_previsao" }),
        balde({ temDataEntrega: true, noPrazo: false, responsabilidadeCliente: null }),
      ],
      [],
      BAIXAS,
    );
    expect(linha).toMatchObject({ noPrazoAberto: 1, atrasadas: 0, foraTransp: 1, slaPct: 0 });
  });

  it("ordena por SLA desc (nulo por último) e desempata por total de CT-e; soma peso e frete exatos", () => {
    const linhas = agregarRanking(
      [
        balde({ chave: "A", codigoEfetivo: 85 }),
        balde({ chave: "B", temDataEntrega: true, noPrazo: true, quantidade: 1 }),
        balde({
          chave: "C",
          temDataEntrega: true,
          noPrazo: true,
          quantidade: 3,
          freteCentavos: 10,
        }),
        balde({ chave: "C", codigoEfetivo: 85, freteCentavos: 20, pesoGramas: 1500 }),
        balde({ chave: "", quantidade: 9 }),
      ],
      [],
      BAIXAS,
    );
    expect(linhas.map((l) => l.chave)).toEqual(["C", "B", "A"]);
    expect(linhas[0]).toMatchObject({ frete: 0.3, peso: 1.5 });
  });
});

describe("chaveDoGrupo e decimalEmUnidades", () => {
  it("normaliza CNPJ e cidade", () => {
    expect(chaveDoGrupo("pagador", "12.345.678/0001-90")).toBe("12345678000190");
    expect(chaveDoGrupo("cidade", "  são paulo ")).toBe("SÃO PAULO");
    expect(chaveDoGrupo("cidade", null)).toBe("");
  });

  it("converte o decimal do Postgres sem ponto flutuante", () => {
    expect(decimalEmUnidades("12.345", 3)).toBe(12345);
    expect(decimalEmUnidades("0.1", 2)).toBe(10);
    expect(decimalEmUnidades("7", 2)).toBe(700);
    expect(decimalEmUnidades(null, 2)).toBe(0);
  });
});
