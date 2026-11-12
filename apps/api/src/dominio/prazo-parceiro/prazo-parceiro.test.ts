import { describe, expect, it } from "vitest";

import {
  comparacaoComAnterior,
  diasAbaixoDoPadrao,
  type FatoPrazo,
  fatosDoParceiro,
  histogramaDeAtraso,
  periodoAnterior,
  rankingDoPrazo,
  totaisDoPrazo,
} from "./prazo-parceiro";

const fato = (extra: Partial<FatoPrazo> = {}): FatoPrazo => ({
  prazoOrigem: "proprio",
  dataPrevista: "2026-11-13",
  prazoPadraoData: "2026-11-12",
  parceiroId: null,
  parceiroCnpj: null,
  parceiroNome: null,
  penalizado: false,
  ...extra,
});

describe("prazo do parceiro", () => {
  it("exemplo da spec: total 90%, própria 95%, diferença +5 pp", () => {
    const base = [
      ...Array.from({ length: 80 }, (_, i) => fato({ penalizado: i < 4 })),
      ...Array.from({ length: 20 }, (_, i) => fato({ prazoOrigem: "parceiro", penalizado: i < 6 })),
    ];
    const t = totaisDoPrazo(base);
    expect(t.performanceTotal).toBeCloseTo(0.9);
    expect(t.performancePropria).toBeCloseTo(0.95);
    expect(t.diferencaPp).toBeCloseTo(0.05);
    expect(t.pctPrazoParceiro).toBeCloseTo(0.2);
  });

  it("sem base: performance 1 no atual e delta nulo contra anterior vazio", () => {
    const t = totaisDoPrazo([]);
    expect([t.performanceTotal, t.performancePropria, t.pctNascidos]).toEqual([1, 1, null]);
    expect(comparacaoComAnterior(t, [])).toEqual({ deltaNascidos: 0, deltaGapPp: null });
  });

  it("período anterior do mesmo tamanho", () => {
    expect(periodoAnterior({ inicio: "2026-11-01", fim: "2026-11-10" })).toEqual({
      inicio: "2026-10-22",
      fim: "2026-10-31",
    });
  });

  it("emissão 10/11, previsão 11/11 ⇒ padrão 12/11, 1 dia abaixo, faixa '1 dia'", () => {
    const c = fato({ dataPrevista: "2026-11-11", prazoPadraoData: "2026-11-12" });
    expect(diasAbaixoDoPadrao(c)).toBe(1);
    expect(histogramaDeAtraso([c, fato({ dataPrevista: "2026-11-01" })])).toEqual([
      { faixa: "1 dia", qtd: 1 },
      { faixa: "11+ dias", qtd: 1 },
    ]);
  });

  it("ranking: uma linha por CNPJ com o nome do cadastro mais recente (Q08)", () => {
    const linhas = rankingDoPrazo(
      [
        fato({
          parceiroId: "p1",
          parceiroCnpj: "11222333000144",
          parceiroNome: "X",
          dataPrevista: "2026-11-11",
        }),
        fato({ parceiroId: "p2", parceiroCnpj: "11222333000144", parceiroNome: "Y" }),
        fato({ parceiroCnpj: "99888777000166", parceiroNome: "SEM CADASTRO" }),
        fato(),
      ],
      [
        {
          id: "p1",
          nome: "Antigo",
          cnpj: "11.222.333/0001-44",
          usaSsw: false,
          criadoEm: new Date("2026-01-01"),
        },
        {
          id: "p2",
          nome: "Novo",
          cnpj: "11222333000144",
          usaSsw: true,
          criadoEm: new Date("2026-06-01"),
        },
      ],
    );
    expect(linhas.map((l) => [l.id, l.nome, l.total, l.nascidosAtrasados])).toEqual([
      ["p2", "Novo", 2, 1],
      ["cnpj:99888777000166", "SEM CADASTRO", 1, 0],
    ]);
  });

  it("detalhe abre os CT-e da linha do ranking: pelo cadastro ou pelo CNPJ sem cadastro", () => {
    const cadastros = [
      {
        id: "p1",
        nome: "Um",
        cnpj: "11222333000144",
        usaSsw: false,
        criadoEm: new Date("2026-01-01"),
      },
    ];
    const doCadastroSemCnpjNoCte = fato({ parceiroId: "p1" });
    const doCnpj = fato({ parceiroCnpj: "11222333000144" });
    const semCadastro = fato({ parceiroCnpj: "99888777000166" });
    const base = [doCadastroSemCnpjNoCte, doCnpj, semCadastro];

    const p1 = fatosDoParceiro(base, cadastros, "p1");
    expect(p1.cadastro?.nome).toBe("Um");
    expect(p1.itens).toEqual([doCadastroSemCnpjNoCte, doCnpj]);
    expect(fatosDoParceiro(base, cadastros, "cnpj:99888777000166").itens).toEqual([semCadastro]);
    expect(fatosDoParceiro(base, cadastros, "p9").itens).toEqual([]);
  });
});
