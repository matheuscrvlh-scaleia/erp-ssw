import { describe, expect, it } from "vitest";

import { ehChunkObsoleto } from "./version";

describe("ehChunkObsoleto", () => {
  it("reconhece a falha de chunk de cada navegador e ignora o resto", () => {
    for (const mensagem of [
      "Failed to fetch dynamically imported module: /assets/calendario-x.js",
      "Importing a module script failed.",
      "error loading dynamically imported module",
    ]) {
      expect(ehChunkObsoleto(new Error(mensagem))).toBe(true);
    }
    expect(ehChunkObsoleto(new Error("Feriado não encontrado."))).toBe(false);
    expect(ehChunkObsoleto("Failed to fetch dynamically imported module")).toBe(false);
  });
});
