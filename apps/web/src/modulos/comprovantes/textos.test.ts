import { describe, expect, it } from "vitest";

import { pct, TITULO_DO_STATUS } from "./textos";

describe("textos de /comprovantes", () => {
  it("título pelo card que abriu a lista", () => {
    expect(TITULO_DO_STATUS.pendentes).toBe("Comprovantes pendentes");
    expect(TITULO_DO_STATUS.todos).toBe("CT-e entregues");
  });

  it("percentual sem entregue vira travessão", () => {
    expect(pct(null)).toBe("—");
    expect(pct(0.5)).toBe("50,0%");
  });
});
