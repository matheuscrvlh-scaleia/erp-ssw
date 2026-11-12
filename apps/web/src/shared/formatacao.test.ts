import { describe, expect, it } from "vitest";

import {
  formatarCnpj,
  formatarData,
  formatarDataHora,
  formatarDecimal,
  formatarDiaMes,
  formatarInteiro,
  formatarMoeda,
  formatarParticipacao,
  formatarPercentual,
  formatarPeso,
  formatarPontos,
} from "./formatacao";

describe("formatação pt-BR", () => {
  it("números com separador brasileiro", () => {
    expect(formatarInteiro(1234567)).toBe("1.234.567");
    expect(formatarPercentual(0.951)).toBe("95,1%");
    expect(formatarMoeda(1234.5)).toMatch(/^R\$\s1\.234,50$/);
  });

  it("percentual: um arredondamento só; ponto só onde o sistema atual usa ponto", () => {
    // 0,9505: o card fazia toFixed ("95.0%") e o PDF Intl ("95,1%") — o mesmo número em dois.
    expect(formatarPercentual(0.9505)).toBe("95,1%");
    expect(formatarPercentual(0.9505, { separador: "." })).toBe("95.1%");
    expect(formatarPercentual(95.05, { escala: "cem" })).toBe("95,1%");
    expect(formatarPercentual(99.724, { escala: "cem", casas: 2 })).toBe("99,72%");
    expect(formatarPercentual(0.4, { casas: 0 })).toBe("40%");
    expect(formatarPercentual(null, { escala: "cem" })).toBe("—");
  });

  it("vazio vira traço", () => {
    expect(formatarInteiro(null)).toBe("—");
    expect(formatarPercentual(Number.NaN)).toBe("—");
    expect(formatarData("")).toBe("—");
    expect(formatarDataHora("lixo")).toBe("—");
  });

  it("datas sem deslocar o dia", () => {
    expect(formatarData("2026-01-01")).toBe("01/01/2026");
    expect(formatarDataHora("2026-11-10T13:05:00Z")).toBe("10/11/2026 10:05");
  });

  it("peso com as casas de cada tela de hoje (eram três fmtPeso)", () => {
    // Performance
    expect(formatarPeso(0)).toBe("0 kg");
    expect(formatarPeso(850.4)).toBe("850 kg");
    expect(formatarPeso(1500)).toBe("1,5 t");
    expect(formatarPeso(2000)).toBe("2 t");
    // Romaneio
    expect(formatarPeso(2000, { fixas: true })).toBe("2,0 t");
    expect(formatarPeso(850.6, { fixas: true })).toBe("851 kg");
    expect(formatarPeso(null, { fixas: true })).toBe("—");
    // Detalhe do CT-e
    const ctrc = { tonelada: 3, quilo: 3, fixas: true };
    expect(formatarPeso(850, ctrc)).toBe("850,000 kg");
    expect(formatarPeso(1500, ctrc)).toBe("1,500 t");
  });

  it("moeda com e sem centavos, decimal, pontos e participação", () => {
    expect(formatarMoeda(1234.5, { centavos: false })).toMatch(/^R\$\s1\.235$/);
    expect(formatarDecimal(1234.567)).toBe("1.234,57");
    expect(formatarDecimal(12.5, 0)).toBe("13");
    expect(formatarPontos(0.023)).toBe("+2,3 pp");
    expect(formatarPontos(-0.01)).toBe("-1,0 pp");
    expect(formatarPontos(0)).toBe("0,0 pp");
    expect(formatarPontos(null)).toBe("—");
    expect(formatarParticipacao(1, 8)).toBe("12,5%");
    expect(formatarParticipacao(1, 0)).toBe("—");
  });

  it("dia e mês; data de instante no fuso da empresa; data e hora com vírgula", () => {
    expect(formatarDiaMes("2026-11-05")).toBe("05/11");
    // 02:00 UTC de 10/11 ainda é 09/11 em Brasília.
    expect(formatarData("2026-11-10T02:00:00Z")).toBe("09/11/2026");
    expect(formatarData("2026-11-10T02:00:00Z", "UTC")).toBe("10/11/2026");
    expect(formatarDataHora("2026-11-10T17:30:00Z", "America/Sao_Paulo", { virgula: true })).toBe(
      "10/11/2026, 14:30",
    );
  });

  it("CNPJ com máscara", () => {
    expect(formatarCnpj("14413548000178")).toBe("14.413.548/0001-78");
  });
});
