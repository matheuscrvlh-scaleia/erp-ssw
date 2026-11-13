import { formatarDataHora } from "@erp/shared/formatting";
import { describe, expect, it } from "vitest";

import { dataHora, num } from "./texts";

describe("textos da ingestão", () => {
  it("data e hora, ou traço sem data", () => {
    expect(dataHora("2026-11-10T12:58:40Z")).toBe(formatarDataHora("2026-11-10T12:58:40Z"));
    expect(dataHora(null)).toBe("—");
    expect(dataHora(undefined)).toBe("—");
  });

  it("número com milhar, ou traço quando não é número", () => {
    expect(num(12345)).toBe("12.345");
    expect(num(0)).toBe("0");
    expect(num(undefined)).toBe("—");
    expect(num("12")).toBe("—");
  });
});
