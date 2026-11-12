import { describe, expect, it } from "vitest";

import { juntarFiltroTexto, lerFiltroTexto } from "./filtro-texto";

describe("filtro de texto com vários valores", () => {
  it("separa por '|', tira espaços, vazios e repetidos", () => {
    expect(lerFiltroTexto("Natura | Avon||natura|Avon ")).toEqual(["Natura", "Avon", "natura"]);
    expect(lerFiltroTexto("")).toEqual([]);
    expect(lerFiltroTexto(undefined)).toEqual([]);
  });

  it("junta de volta no mesmo formato", () => {
    expect(juntarFiltroTexto(["Natura", " Avon", "", "Natura"])).toBe("Natura|Avon");
    expect(juntarFiltroTexto([])).toBe("");
  });
});
