import { describe, expect, it } from "vitest";

import { destinoInterno } from "./destino";

const ORIGEM = "https://painel.exemplo.com.br";

describe("destinoInterno", () => {
  it("aceita caminho interno com query e fragmento", () => {
    expect(destinoInterno("/calendario?ano=2026#x", ORIGEM)).toBe("/calendario?ano=2026#x");
  });

  it("recusa outra origem, inclusive com tab, espaço, CR e barra invertida no meio", () => {
    for (const d of [
      "/\t/evil.example",
      decodeURIComponent("%2F%09%2Fevil.example"),
      "/\r\n/evil.example",
      "/ /evil.example",
      "//evil.example",
      "/\\evil.example",
      "https://evil.example",
      "evil.example",
      "",
      undefined,
    ]) {
      expect(destinoInterno(d, ORIGEM)).toBe("/");
    }
  });
});
