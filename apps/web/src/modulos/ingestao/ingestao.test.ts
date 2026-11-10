import { describe, expect, it } from "vitest";

import { proximaExecucao } from "./PaginaXmlCte";

describe("próxima execução do FTP (Q37: todo minuto, exceto :00 e :30)", () => {
  it("pula :00 e :30", () => {
    expect(proximaExecucao(new Date("2026-11-10T12:58:40Z")).toISOString()).toBe(
      "2026-11-10T12:59:00.000Z",
    );
    expect(proximaExecucao(new Date("2026-11-10T12:59:10Z")).toISOString()).toBe(
      "2026-11-10T13:01:00.000Z",
    );
    expect(proximaExecucao(new Date("2026-11-10T13:29:00Z")).toISOString()).toBe(
      "2026-11-10T13:31:00.000Z",
    );
  });
});
