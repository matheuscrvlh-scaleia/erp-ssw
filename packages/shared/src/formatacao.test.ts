import { describe, expect, it } from "vitest";

import {
  formatarCnpj,
  formatarData,
  formatarDataHora,
  formatarInteiro,
  formatarMoeda,
  formatarPercentual,
} from "./formatacao";

describe("formatação pt-BR", () => {
  it("números com separador brasileiro", () => {
    expect(formatarInteiro(1234567)).toBe("1.234.567");
    expect(formatarPercentual(0.951)).toBe("95,1%");
    expect(formatarMoeda(1234.5)).toMatch(/^R\$\s1\.234,50$/);
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

  it("CNPJ com máscara", () => {
    expect(formatarCnpj("14413548000178")).toBe("14.413.548/0001-78");
  });
});
