import { describe, expect, it } from "vitest";

import { alternar, lerArquivo050 } from "./rules";

describe("regras de /coletas", () => {
  it("alternância de um valor na lista do filtro", () => {
    expect(alternar(["A", "B"], "A")).toEqual(["B"]);
    expect(alternar(["A"], "B")).toEqual(["A", "B"]);
  });

  it("lê o arquivo do 050 em ISO-8859-1 (acentos do SSW)", async () => {
    const latin1 = new Uint8Array([0x43, 0x4f, 0x4c, 0x45, 0x54, 0xc3]); // "COLETÃ"
    expect(await lerArquivo050({ arrayBuffer: () => Promise.resolve(latin1.buffer) })).toBe(
      "COLETÃ",
    );
  });
});
