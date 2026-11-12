import { describe, expect, it } from "vitest";

import { dataBr, formatarHoras, localizacaoDaBatida, MOTIVO_LABEL, TIPO_LABEL } from "./textos";

describe("textos do ponto (Ahgora)", () => {
  it("horas sem os minutos quando zerados; minutos com dois dígitos", () => {
    expect(formatarHoras(0)).toBe("0h");
    expect(formatarHoras(480)).toBe("8h");
    expect(formatarHoras(500)).toBe("8h 20m");
    expect(formatarHoras(65)).toBe("1h 05m");
  });

  it("data ISO no formato brasileiro", () => {
    expect(dataBr("2026-11-01")).toBe("01/11/2026");
  });

  it("localização com 6 casas, ou travessão se faltar uma coordenada", () => {
    expect(localizacaoDaBatida(-23.5, -46.6333333)).toBe("-23.500000, -46.633333");
    expect(localizacaoDaBatida(-23.5, undefined)).toBe("—");
    expect(localizacaoDaBatida(undefined, undefined)).toBe("—");
  });

  it("rótulos do tipo de batida e do motivo de revisão", () => {
    expect(TIPO_LABEL.DELETADA).toBe("Deletada");
    expect(MOTIVO_LABEL.impar).toContain("Número ímpar de batidas");
  });
});
