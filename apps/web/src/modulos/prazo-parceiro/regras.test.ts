import { describe, expect, it } from "vitest";

import { tomDoSla } from "./regras";

describe("tomDoSla", () => {
  it("tom pela meta e pelo alerta do SLA", () => {
    const sla = { meta: 0.95, alerta: 0.9 };
    expect(tomDoSla(0.96, sla)).toBe("bom");
    expect(tomDoSla(0.92, sla)).toBe("alerta");
    expect(tomDoSla(0.8, sla)).toBe("ruim");
  });
});
