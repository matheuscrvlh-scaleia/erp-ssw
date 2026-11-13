import { describe, expect, it } from "vitest";

import { dataDoCalendario, isoDoCalendario } from "./calendar-day";

describe("dia do calendário", () => {
  it("ida e volta sem trocar o dia (meia-noite local, nunca UTC)", () => {
    const data = dataDoCalendario("2026-03-01");
    expect([data.getFullYear(), data.getMonth(), data.getDate(), data.getHours()]).toEqual([
      2026, 2, 1, 0,
    ]);
    expect(isoDoCalendario(data)).toBe("2026-03-01");
    expect(isoDoCalendario(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });
});
